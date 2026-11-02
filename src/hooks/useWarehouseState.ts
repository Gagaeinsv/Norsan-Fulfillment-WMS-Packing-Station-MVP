import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Operator,
  Order,
  OrderItem,
  WarehouseStation,
  ScanEvent,
  Product,
  IssueTicket,
  BoxType,
  StationKPIs,
} from "../types/wms";
import { MARKETING_FLYERS, BOX_TYPES } from "../data/marketingFlyers";
import { NORSAN_PRODUCTS } from "../data/norsanProducts";
import { INITIAL_ORDERS } from "../data/mockOrders";
import { INITIAL_STATIONS, OPERATORS } from "../data/mockOperators";
import {
  fetchProducts,
  fetchWarehouseSlots,
  updateSlotAssignment,
  addNewSlot,
  deleteSlot,
  updateProductImageApi,
  fetchOrdersApi,
  saveBulkOrdersApi,
  updateOrderStatusApi,
  updateOrderItemScannedApi,
  updateOrderBoxApi,
  updatePackageCountApi,
  fetchOperatorsApi,
  createOperatorApi,
  updateOperatorApi,
  deleteOperatorApi,
  clearPackedOrdersApi,
} from "../services/api";
import {
  deductPackedOrderFromShelf,
  syncInventoryFromBackend,
} from "../services/mainWarehouseInventoryService";
import {
  WarehouseSlotData,
  generateBolzanoDefaultSlots,
} from "../components/rack/rackTypes";
import { useBarcodeScanner } from "./useBarcodeScanner";
import { useSoundEffects } from "./useSoundEffects";
import {
  lightActiveOrder,
  markProductScanned,
  blinkWrongScan,
  clearOrderLeds,
} from "../services/p2lClient";
import { getProductLotInfo } from "../services/lotTraceabilityService";
import { printDhlThermalLabel } from "../services/dhlLabelPrinter";
import { WMS_PHASE_CONFIG } from "../config/wmsPhaseConfig";

function resolveProduct(
  rawCode: string,
  productsList: Product[]
): Product | undefined {
  const clean = rawCode.trim().toUpperCase();
  const digitsOnly = clean.replace(/[^0-9A-Z]/g, "");
  const noLeadingZero = digitsOnly.replace(/^0+/, "");

  // 1. Check custom user bindings in localStorage
  try {
    const saved = localStorage.getItem("wms_custom_barcode_bindings");
    if (saved) {
      const bindings = JSON.parse(saved);
      const boundSkuOrId =
        bindings[clean] || bindings[digitsOnly] || bindings[noLeadingZero];
      if (boundSkuOrId) {
        const boundProd =
          productsList.find(
            (p) => p.sku === boundSkuOrId || p.id === boundSkuOrId
          ) ||
          NORSAN_PRODUCTS.find(
            (p) => p.sku === boundSkuOrId || p.id === boundSkuOrId
          );
        if (boundProd) return boundProd;
      }
    }
  } catch {
    // ignore
  }

  // 2. Direct catalog match
  const allProds = [...productsList, ...NORSAN_PRODUCTS];
  return allProds.find((p) => {
    const pEan = (p.ean || "").toUpperCase();
    const pSku = (p.sku || "").toUpperCase();
    const pEanNoZero = pEan.replace(/^0+/, "");

    if (
      pEan === clean ||
      pSku === clean ||
      pEan === digitsOnly ||
      pSku === digitsOnly
    )
      return true;
    if (noLeadingZero && pEanNoZero && noLeadingZero === pEanNoZero) return true;

    if (p.aliases && p.aliases.length > 0) {
      return p.aliases.some((a) => {
        const aClean = a.trim().toUpperCase();
        const aNoZero = aClean.replace(/^0+/, "");
        return (
          aClean === clean ||
          aClean === digitsOnly ||
          (noLeadingZero && aNoZero && noLeadingZero === aNoZero)
        );
      });
    }

    return false;
  });
}

export function useWarehouseState() {
  const [activeView, setActiveView] = useState<"packing" | "supervisor">(
    "packing",
  );
  const [operators, setOperators] = useState<Operator[]>(OPERATORS);
  const [currentOperator, setCurrentOperator] = useState<Operator>(
    OPERATORS[0],
  ); // Serhii Haharin
  const [stations, setStations] =
    useState<WarehouseStation[]>(INITIAL_STATIONS);
  const isLegacyDemoOrder = (o: Order) =>
    !o ||
    !o.id ||
    o.id.startsWith("ord-mvp-") ||
    o.id.startsWith("ord-0") ||
    o.id.startsWith("ord-web-");

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      localStorage.removeItem("wms_orders");
      const saved = localStorage.getItem("wms_orders_prod_v1");
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((o: Order) => !isLegacyDemoOrder(o));
        }
      }
    } catch {
      // fallback
    }
    // Clean production start: start with saved orders or empty queue ready for Selly ERP sync
    return [];
  });

  useEffect(() => {
    localStorage.setItem("wms_orders_prod_v1", JSON.stringify(orders));
  }, [orders]);

  const [activeOrderId, setActiveOrderId] = useState<string>(() => {
    localStorage.removeItem("wms_active_order_id");
    const saved = localStorage.getItem("wms_active_order_id_prod_v1");
    if (saved && orders.some((o) => o.id === saved)) return saved;
    return orders[0]?.id || "";
  });

  useEffect(() => {
    localStorage.setItem("wms_active_order_id_prod_v1", activeOrderId);
  }, [activeOrderId]);

  const [stationConfigId, setStationConfigId] = useState<string>(() => {
    return localStorage.getItem("stationConfigId") || "STATION_01";
  });

  useEffect(() => {
    localStorage.setItem("stationConfigId", stationConfigId);
  }, [stationConfigId]);

  const [lastScan, setLastScan] = useState<ScanEvent | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const getCustomProductImages = (): Record<string, string> => {
    try {
      return JSON.parse(
        localStorage.getItem("wms_custom_product_images") || "{}",
      );
    } catch {
      return {};
    }
  };

  const [productsList, setProductsList] = useState<Product[]>(() => {
    const customImgs = getCustomProductImages();
    return NORSAN_PRODUCTS.map((p) => ({
      ...p,
      imageUrl: customImgs[p.id] || p.imageUrl,
    }));
  });
  const [slotsList, setSlotsList] = useState<WarehouseSlotData[]>([]);

  // DHL Print Timing Preference: "on_scan" (immediate on slip scan) or "on_finish" (on box close)
  const [dhlPrintTiming, setDhlPrintTiming] = useState<"on_scan" | "on_finish">(() => {
    return (localStorage.getItem("wms_dhl_print_timing") as "on_scan" | "on_finish") || "on_scan";
  });

  const toggleDhlPrintTiming = useCallback(() => {
    setDhlPrintTiming((prev) => {
      const next = prev === "on_scan" ? "on_finish" : "on_scan";
      localStorage.setItem("wms_dhl_print_timing", next);
      return next;
    });
  }, []);

  // Modals for Selly ERP CSV import and Barcode Binding
  const [isSellyModalOpen, setIsSellyModalOpen] = useState(false);
  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [unboundBarcode, setUnboundBarcode] = useState<string>("");

  // Load live DB data from SQLite backend on mount
  useEffect(() => {
    const customImgs = getCustomProductImages();

    // 1. Fetch catalog products
    fetchProducts().then((prods) => {
      if (prods && prods.length > 0) {
        const merged = prods.map((p) => {
          const staticProd = NORSAN_PRODUCTS.find(
            (sp) => sp.sku === p.sku || sp.id === p.id,
          );
          return {
            ...p,
            imageUrl: customImgs[p.id] || p.imageUrl,
            aliases: Array.from(
              new Set([...(staticProd?.aliases || []), ...(p.aliases || [])]),
            ),
          };
        });
        setProductsList(merged);
      }
    });

    // 2. Fetch warehouse slots
    fetchWarehouseSlots().then((slots) => {
      if (slots && slots.length > 0) {
        const mergedSlots = slots.map((s) => {
          if (s.product_id && customImgs[s.product_id]) {
            return { ...s, product_image_url: customImgs[s.product_id] };
          }
          return s;
        });
        setSlotsList(mergedSlots);
      }
    });

    // 3. Fetch production orders from SQLite backend (excluding any legacy demo IDs)
    fetchOrdersApi().then((serverOrders) => {
      if (serverOrders && Array.isArray(serverOrders)) {
        const cleanOrders = serverOrders.filter((o) => !isLegacyDemoOrder(o));
        setOrders(cleanOrders);
        setActiveOrderId((prev) => {
          if (prev && cleanOrders.some((o) => o.id === prev)) return prev;
          return cleanOrders[0]?.id || "";
        });
      }
    });

    // 4. Fetch registered warehouse staff from SQLite backend
    fetchOperatorsApi().then((serverOps) => {
      if (serverOps && Array.isArray(serverOps) && serverOps.length > 0) {
        setOperators(serverOps);
        setCurrentOperator((prev) => {
          const matched = serverOps.find(
            (o) => o.id === prev.id || o.operatorCode === prev.operatorCode,
          );
          return matched || serverOps[0];
        });
      }
    });

    // 5. Sync Inventory & FEFO Lots from SQLite backend (only when Phase 2-3 Ecosystem is enabled)
    if (WMS_PHASE_CONFIG.ENABLE_WAREHOUSE_INVENTORY_ERP) {
      syncInventoryFromBackend(NORSAN_PRODUCTS).catch(() => {});
    }

    // 6. Multi-Station Live Sync Polling (every 5 seconds) across ST-01..ST-03 & SUP-HUB
    const syncTimer = setInterval(() => {
      fetchOrdersApi().then((serverOrders) => {
        if (serverOrders && Array.isArray(serverOrders)) {
          const cleanOrders = serverOrders.filter((o) => !isLegacyDemoOrder(o));
          setOrders((prev) => {
            if (cleanOrders.length === 0 && prev.length > 0) return prev;
            return cleanOrders;
          });
        }
      });
      fetchOperatorsApi().then((serverOps) => {
        if (serverOps && Array.isArray(serverOps) && serverOps.length > 0) {
          setOperators(serverOps);
        }
      });
      if (WMS_PHASE_CONFIG.ENABLE_WAREHOUSE_INVENTORY_ERP) {
        syncInventoryFromBackend(NORSAN_PRODUCTS).catch(() => {});
      }
    }, 5000);

    return () => clearInterval(syncTimer);
  }, []);

  // Update product photo (Team Lead feature)
  const handleUpdateProductImage = useCallback(
    (productId: string, imageUrl: string) => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("wms_custom_product_images") || "{}",
        );
        if (imageUrl) {
          saved[productId] = imageUrl;
        } else {
          delete saved[productId];
        }
        localStorage.setItem(
          "wms_custom_product_images",
          JSON.stringify(saved),
        );
      } catch (e) {
        console.warn("Could not save product image to localStorage", e);
      }

      // Sync to SQLite backend if online
      updateProductImageApi(productId, imageUrl).catch(() => {});

      // Instant optimistic state update for products
      setProductsList((prev) =>
        prev.map((p) => {
          if (p.id === productId || p.sku === productId) {
            return { ...p, imageUrl };
          }
          return p;
        }),
      );

      // Instant update for shelf slots
      setSlotsList((prev) =>
        prev.map((s) => {
          if (s.product_id === productId) {
            return { ...s, product_image_url: imageUrl };
          }
          return s;
        }),
      );

      // Instant update for active orders containing this product
      setOrders((prev) =>
        prev.map((ord) => ({
          ...ord,
          items: ord.items.map((it) => {
            if (it.product.id === productId || it.product.sku === productId) {
              return {
                ...it,
                product: {
                  ...it.product,
                  imageUrl,
                },
              };
            }
            return it;
          }),
        })),
      );
    },
    [],
  );

  // Reset shelf slots to standard Bolzano Hub 5-Tier layout
  const handleResetSlotsToDefault = useCallback(() => {
    localStorage.removeItem("wms_slots");
    const fresh = generateBolzanoDefaultSlots(productsList);
    setSlotsList(fresh);
    localStorage.setItem("wms_slots", JSON.stringify(fresh));
  }, [productsList]);

  // Handle dynamic slot reassignment (5S Slotting Manager)
  const handleAssignSlot = useCallback(
    async (slotCode: string, productId: string | null) => {
      await updateSlotAssignment(slotCode, productId);
      const updatedSlots = await fetchWarehouseSlots();
      setSlotsList(updatedSlots);
      const updatedProds = await fetchProducts();
      setProductsList(updatedProds);

      // Update active orders with new shelf coordinates
      setOrders((prev) =>
        prev.map((ord) => ({
          ...ord,
          items: ord.items.map((it) => {
            const matchingProd = updatedProds.find(
              (p) => p.id === it.product.id || p.ean === it.product.ean,
            );
            if (matchingProd) {
              return {
                ...it,
                product: {
                  ...it.product,
                  shelfLocation: matchingProd.shelfLocation,
                  rackSide: matchingProd.rackSide,
                  tier: matchingProd.tier,
                },
              };
            }
            return it;
          }),
        })),
      );
    },
    [],
  );

  // Add a new slot to a tier with instant optimistic UI update
  const handleAddSlot = useCallback(
    async (side: "S" | "D", tier: 1 | 2 | 3) => {
      const alphabet = [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
      ];
      const existingCodes = new Set(
        slotsList
          .filter((s) => s.side === side && Number(s.tier) === Number(tier))
          .map((s) => s.slot_code),
      );
      const nextLetter =
        alphabet.find((l) => !existingCodes.has(`${side}${tier}-${l}`)) ||
        `X${existingCodes.size + 1}`;
      const newSlotCode = `${side}${tier}-${nextLetter}`;

      const newSlotObj: WarehouseSlotData = {
        slot_code: newSlotCode,
        side: side,
        tier: tier,
        description: `Scaffale ${side} • Piano ${tier} • Slot ${newSlotCode}`,
        product_id: null,
      };

      // Instant optimistic update
      setSlotsList((prev) => [...prev, newSlotObj]);

      // Persist to backend database
      try {
        await addNewSlot(newSlotCode, side, tier);
        const updatedSlots = await fetchWarehouseSlots();
        if (updatedSlots && updatedSlots.length > 0) {
          setSlotsList(updatedSlots);
        }
      } catch (_e) {
        console.warn("Backend sync failed, state preserved locally");
      }
    },
    [slotsList],
  );

  // Delete a slot with instant optimistic UI update
  const handleDeleteSlot = useCallback(async (slotCode: string) => {
    // Instant optimistic update
    setSlotsList((prev) => prev.filter((s) => s.slot_code !== slotCode));

    // Persist to backend database
    try {
      await deleteSlot(slotCode);
      const updatedSlots = await fetchWarehouseSlots();
      if (updatedSlots && updatedSlots.length > 0) {
        setSlotsList(updatedSlots);
      }
      const updatedProds = await fetchProducts();
      if (updatedProds && updatedProds.length > 0) {
        setProductsList(updatedProds);
      }
    } catch (_e) {
      console.warn("Backend sync failed, state preserved locally");
    }
  }, []);

  // Add a new operator (persisted to SQLite backend)
  const handleAddOperator = useCallback((newOp: Operator) => {
    setOperators((prev) => [...prev, newOp]);
    createOperatorApi(newOp).catch(() => {});
  }, []);

  // Update an existing operator / lead (persisted to SQLite backend)
  const handleUpdateOperator = useCallback((updatedOp: Operator) => {
    setOperators((prev) =>
      prev.map((op) => (op.id === updatedOp.id ? updatedOp : op)),
    );
    setCurrentOperator((prev) => (prev.id === updatedOp.id ? updatedOp : prev));
    updateOperatorApi(updatedOp).catch(() => {});
  }, []);

  // Delete an operator (with active operator safety + SQLite persistence)
  const handleDeleteOperator = useCallback((opId: string) => {
    deleteOperatorApi(opId).catch(() => {});
    setOperators((prev) => {
      const remaining = prev.filter((op) => op.id !== opId);
      setCurrentOperator((current) => {
        if (current.id === opId) {
          if (remaining.length > 0) {
            return remaining[0];
          }
          // If no operators remain, lock terminal
          setIsTerminalLocked(true);
          setActiveView("packing");
          return current; // will be stale but terminal is locked
        }
        return current;
      });
      return remaining;
    });
  }, []);

  // Issues queue
  const [issues, setIssues] = useState<IssueTicket[]>([]);

  // Modals & Security state
  const [isRackGuideOpen, setIsRackGuideOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isOperatorAuthOpen, setIsOperatorAuthOpen] = useState(false);
  const [isTerminalLocked, setIsTerminalLocked] = useState(true);
  const [isSupervisorPinModalOpen, setIsSupervisorPinModalOpen] =
    useState(false);

  const leadOperators = useMemo(() => {
    return operators.filter(
      (o) => o.role === "team_lead" || o.role === "supervisor",
    );
  }, [operators]);

  // True when the logged-in operator has edit rights (team lead or supervisor)
  const isTeamLead =
    currentOperator.role === "team_lead" ||
    currentOperator.role === "supervisor";

  // KPIs (Production clean start at 0)
  const [kpis, setKpis] = useState<StationKPIs>({
    totalPackedToday: 0,
    unitsPerHour: 0,
    accuracyPercentage: 100,
    errorsPrevented: 0,
    activeOrderTimeSeconds: 0,
  });

  const {
    playScanSuccess,
    playItemComplete,
    playScanError,
    playOrderComplete,
  } = useSoundEffects();

  const activeOrder = useMemo(() => {
    return orders.find((o) => o.id === activeOrderId) || orders[0];
  }, [orders, activeOrderId]);

  // Toggle marketing flyer inclusion
  const handleToggleFlyer = useCallback(
    (flyerId: string) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === activeOrderId) {
            const updatedFlyers = o.marketingFlyers.map((f) => {
              if (f.id === flyerId) {
                return { ...f, isIncluded: !f.isIncluded };
              }
              return f;
            });
            return { ...o, marketingFlyers: updatedFlyers };
          }
          return o;
        }),
      );
      if (!isMuted) playScanSuccess();
    },
    [activeOrderId, isMuted, playScanSuccess],
  );

  // Toggle retention gift confirmation
  const handleToggleGift = useCallback(() => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === activeOrderId) {
          return { ...o, giftConfirmed: !o.giftConfirmed };
        }
        return o;
      }),
    );
    if (!isMuted) playScanSuccess();
  }, [activeOrderId, isMuted, playScanSuccess]);

  // Toggle physical document confirmation
  const handleTogglePhysicalDocument = useCallback(() => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === activeOrderId) {
          return {
            ...o,
            physicalDocumentConfirmed: !o.physicalDocumentConfirmed,
          };
        }
        return o;
      }),
    );
    if (!isMuted) playScanSuccess();
  }, [activeOrderId, isMuted, playScanSuccess]);

  // Update FEFO Lot & Expiry Date on an item in the active order
  const handleUpdateItemLot = useCallback(
    (sku: string, lotNumber: string, expiryDate: string) => {
      if (!activeOrder) return;
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === activeOrder.id) {
            return {
              ...o,
              items: o.items.map((it) =>
                it.product.sku === sku
                  ? { ...it, lotNumber, expiryDate }
                  : it,
              ),
            };
          }
          return o;
        }),
      );
      if (!isMuted) playScanSuccess();
      setLastScan({
        id: Math.random().toString(),
        rawCode: lotNumber,
        resultType: "command",
        status: "info",
        title: "Tracciabilità FEFO Aggiornata",
        message: `Registrato Lotto ${lotNumber} (Scad. ${expiryDate}) per SKU ${sku}`,
        timestamp: Date.now(),
      });
    },
    [activeOrder, isMuted, playScanSuccess],
  );

  // Fast Confirmation for Paper-based Picking (validates product items from paper slip while preserving Poka-Yoke for flyers/gifts/B2B docs)
  const handleConfirmAllItems = useCallback(() => {
    if (!activeOrder || activeOrder.status === "packed") return;

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === activeOrder.id) {
          const completedItems = o.items.map((it) => {
            const lotInfo = getProductLotInfo(it.product);
            return {
              ...it,
              quantityScanned: it.quantityRequired,
              status: "completed" as const,
              lotNumber: it.lotNumber || lotInfo.lotNumber,
              expiryDate: it.expiryDate || lotInfo.expiryDate,
            };
          });
          return {
            ...o,
            items: completedItems,
          };
        }
        return o;
      }),
    );
    clearOrderLeds(activeOrder); // Turn off Pick-to-Light LEDs

    if (!isMuted) playOrderComplete();
    printDhlThermalLabel(activeOrder, activeOrder.packageCount || 1);
    setLastScan({
      id: Math.random().toString(),
      rawCode: activeOrder.orderNumber,
      resultType: "product_match",
      status: "success",
      title: "Articoli & Bolla Confermati ✓",
      message: `Articoli verificati e confermati. Etichetta DHL inviata al termo-printer. Scansiona la prossima bolla per avanzare.`,
      timestamp: Date.now(),
    });
  }, [activeOrder, isMuted, playOrderComplete, playItemComplete]);

  // Simulate Incoming Web Order from norsan.it
  const handleSimulateIncomingWebOrder = useCallback(() => {
    const webOrderNum = `ORD-2026-${Math.floor(8820 + Math.random() * 80)}`;
    const italianCities = [
      {
        name: "Firenze",
        zip: "50122",
        prov: "FI",
        addr: "Via de' Tornabuoni 14",
        cust: "Prof. Andrea Conti",
      },
      {
        name: "Venezia",
        zip: "30124",
        prov: "VE",
        addr: "Fondamenta Zattere 78",
        cust: "Chiara Moretti",
      },
      {
        name: "Napoli",
        zip: "80121",
        prov: "NA",
        addr: "Via Chiaia 192",
        cust: "Dott. Salvatore Esposito",
      },
      {
        name: "Bologna",
        zip: "40126",
        prov: "BO",
        addr: "Via dell'Indipendenza 55",
        cust: "Laura Barbieri",
      },
    ];
    const pickedCity =
      italianCities[Math.floor(Math.random() * italianCities.length)];

    const newOrder: Order = {
      id: `ord-web-${Date.now()}`,
      orderNumber: webOrderNum,
      barcode: webOrderNum,
      source: "norsan.it Web Shop",
      createdAt: Date.now(),
      customerName: pickedCity.cust,
      customerAddress: pickedCity.addr,
      customerCity: pickedCity.name,
      customerZip: pickedCity.zip,
      customerProvince: pickedCity.prov,
      customerCountry: "IT",
      courier: "DHL Express",
      trackingNumber: `JJD0184920019${Math.floor(100000 + Math.random() * 900000)}`,
      priority: "express",
      boxBranding: "norsan_logo",
      boxRecommendation: "BOX-NOR-M",
      marketingFlyers: [{ ...MARKETING_FLYERS[0], isIncluded: false }],
      status: "ready_to_pack",
      isSubscription: false,
      customerOrderCount: 1,
      retentionGift: "none",
      specialNotes:
        "ORDINE ONLINE DIRETTO DA NORSAN.IT • Scatola Logo NORSAN + Volantino Guida 2026",
      items: [
        {
          product: NORSAN_PRODUCTS[0], // Total Limone 200ml (Slot S2-A)
          quantityRequired: 2,
          quantityScanned: 0,
          status: "pending",
        },
        {
          product: NORSAN_PRODUCTS[9], // Vitamina D3+K2 Gocce (Slot D3-A)
          quantityRequired: 1,
          quantityScanned: 0,
          status: "pending",
        },
      ],
    };

    setOrders((prev) => [newOrder, ...prev]);
    if (!isMuted) playScanSuccess();
    setLastScan({
      id: Math.random().toString(),
      rawCode: newOrder.barcode,
      resultType: "order_switch",
      status: "info",
      title: "Nuovo Ordine Ricevuto da norsan.it",
      message: `Ricevuto ${newOrder.orderNumber} per ${newOrder.customerName} (${newOrder.customerCity}) via Webhook API!`,
      timestamp: Date.now(),
    });
  }, [isMuted, playScanSuccess]);

  // Main Barcode Processing Engine
  const handleBarcodeScanned = useCallback(
    (code: string, quantityToAdd: number = 1) => {
      const rawCode = code.trim().toUpperCase();

      // 0. Check if it's an Operator Badge Barcode (e.g. "OP-01", "OP-02", "TL-01")
      const matchedOperator = operators.find((op) => {
        const opCode = op.operatorCode.toUpperCase();
        return (
          opCode === rawCode ||
          opCode.replace("-", "") === rawCode ||
          rawCode === opCode.replace("-0", "-")
        );
      });
      if (matchedOperator) {
        setCurrentOperator(matchedOperator);
        if (
          matchedOperator.role !== "team_lead" &&
          matchedOperator.role !== "supervisor"
        ) {
          setActiveView("packing");
        }
        setIsTerminalLocked(false);
        setIsSupervisorPinModalOpen(false);
        if (!isMuted) playScanSuccess();
        setLastScan({
          id: Math.random().toString(),
          rawCode,
          resultType: "operator_login",
          status: "info",
          title: "Login Operatore Riuscito",
          message: `Autenticato: ${matchedOperator.name} [${matchedOperator.operatorCode}] • Ruolo: ${matchedOperator.role === "team_lead" ? "Team Lead" : "Packer"}`,
          timestamp: Date.now(),
        });
        return;
      }

      // 1. Check if it's an Order Barcode (e.g. "ORD-2026-8812")
      const matchedOrder = orders.find(
        (o) =>
          o.barcode.toUpperCase() === rawCode ||
          o.orderNumber.toUpperCase() === rawCode,
      );

      if (matchedOrder) {
        // If there was a previous order active and not yet packed, finalize it as packed
        if (activeOrder && activeOrder.id !== matchedOrder.id && activeOrder.status !== "packed") {
          if (WMS_PHASE_CONFIG.ENABLE_WAREHOUSE_INVENTORY_ERP) {
            deductPackedOrderFromShelf(
              productsList,
              activeOrder.items.map((it) => ({
                sku: it.product.sku,
                quantity: it.quantityRequired,
              })),
            );
          }
          updateOrderStatusApi(
            activeOrder.id,
            "packed",
            currentOperator.id,
            stationConfigId,
          ).catch(() => {});
          setOrders((prev) =>
            prev.map((o) =>
              o.id === activeOrder.id
                ? { ...o, status: "packed", packingCompletedAt: Date.now() }
                : o,
            ),
          );
        }

        // Close any open modal
        setIsLabelModalOpen(false);

        if (matchedOrder.status === "packed") {
          // If already packed, re-print DHL label for convenience
          setActiveOrderId(matchedOrder.id);
          const colli = matchedOrder.packageCount || 1;
          printDhlThermalLabel(matchedOrder, colli);
          if (!isMuted) playScanSuccess();
          setLastScan({
            id: Math.random().toString(),
            rawCode,
            resultType: "order_switch",
            status: "info",
            title: "Ristampa Etichetta DHL (Ordine Concluso)",
            message: `Ristampa etichetta DHL (${colli} ${colli === 1 ? "collo" : "colli"}) inviata per l'ordine completato ${matchedOrder.orderNumber}.`,
            timestamp: Date.now(),
          });
          return;
        }

        // Auto-fulfill order items with FEFO lot traceability (no individual product scan required by management)
        const completedItems = matchedOrder.items.map((it) => {
          const lotInfo = getProductLotInfo(it.product);
          return {
            ...it,
            quantityScanned: it.quantityRequired,
            status: "completed" as const,
            lotNumber: it.lotNumber || lotInfo.lotNumber,
            expiryDate: it.expiryDate || lotInfo.expiryDate,
          };
        });

        const completedFlyers = matchedOrder.marketingFlyers.map((f) => ({
          ...f,
          isIncluded: true,
        }));

        // Volumetric box estimation: standard BOX-L holds up to 10 bottles. If >10 items, auto-calculate 2 colli
        const totalUnits = matchedOrder.items.reduce(
          (sum, it) => sum + it.quantityRequired,
          0,
        );
        const calculatedColli =
          matchedOrder.packageCount && matchedOrder.packageCount > 1
            ? matchedOrder.packageCount
            : totalUnits > 10
              ? Math.ceil(totalUnits / 8)
              : 1;

        const fulfilledOrder: Order = {
          ...matchedOrder,
          status: "packing",
          packageCount: calculatedColli,
          items: completedItems,
          marketingFlyers: completedFlyers,
          giftConfirmed: true,
          physicalDocumentConfirmed: true,
        };

        // Update state and active order
        setOrders((prev) =>
          prev.map((o) => (o.id === matchedOrder.id ? fulfilledOrder : o)),
        );
        setActiveOrderId(matchedOrder.id);

        // Async sync to SQLite backend with station assignment
        updateOrderStatusApi(
          matchedOrder.id,
          "packing",
          currentOperator.id,
          stationConfigId,
        ).catch(() => {});

        // Light Pick-to-Light LEDs for the active order
        lightActiveOrder(fulfilledOrder);

        // DHL THERMAL LABEL PRINT: on slip scan or on finish depending on preference
        const colli = fulfilledOrder.packageCount || 1;
        if (dhlPrintTiming === "on_scan") {
          printDhlThermalLabel(fulfilledOrder, colli);
        }

        if (!isMuted) playScanSuccess();

        setLastScan({
          id: Math.random().toString(),
          rawCode,
          resultType: "order_switch",
          status: "success",
          title:
            dhlPrintTiming === "on_scan"
              ? "Bolla Scansionata • Etichetta DHL In Stampa 🖨️"
              : "Bolla Scansionata • Pick-to-Light Attivo",
          message:
            dhlPrintTiming === "on_scan"
              ? `Ordine ${matchedOrder.orderNumber} (${matchedOrder.customerName}) caricato. Stampa etichetta DHL (${colli} ${colli === 1 ? "collo" : "colli"}) inviata al termo-printer. Scaffali illuminati.`
              : `Ordine ${matchedOrder.orderNumber} (${matchedOrder.customerName}) caricato. Scaffali illuminati. L'etichetta DHL verrà stampata a fine inscatolamento.`,
          timestamp: Date.now(),
        });
        return;
      }

      // 1.5. Hardware Scanner Command Barcodes on Packing Bench Table
      if (
        rawCode === "+COLLO" ||
        rawCode === "ADD-BOX" ||
        rawCode === "+1-COLLO" ||
        rawCode === "EXTRA-BOX"
      ) {
        if (activeOrder) {
          const currentCount = activeOrder.packageCount || 1;
          const newCount = currentCount + 1;
          handleUpdatePackageCount(activeOrder.id, newCount);
          if (dhlPrintTiming === "on_scan") {
            printDhlThermalLabel(activeOrder, newCount, newCount - 1);
          }
          if (!isMuted) playScanSuccess();
          setLastScan({
            id: Math.random().toString(),
            rawCode,
            resultType: "command",
            status: "success",
            title:
              dhlPrintTiming === "on_scan"
                ? `Aggiunto Collo ${newCount} • Etichetta Collo ${newCount}/${newCount} In Stampa 📦`
                : `Aggiunto Collo ${newCount} (Stampa a Chiusura) 📦`,
            message:
              dhlPrintTiming === "on_scan"
                ? `Aggiunta scatola aggiuntiva a ${activeOrder.orderNumber}. Stampata solo l'etichetta del nuovo Collo ${newCount} di ${newCount}.`
                : `Contatore aggiornato a ${newCount} colli per ${activeOrder.orderNumber}.`,
            timestamp: Date.now(),
          });
          return;
        }
      }

      if (rawCode === "PRINT-DHL" || rawCode === "STAMPA-DHL") {
        if (activeOrder) {
          const colli = activeOrder.packageCount || 1;
          printDhlThermalLabel(activeOrder, colli);
          if (!isMuted) playScanSuccess();
          setLastScan({
            id: Math.random().toString(),
            rawCode,
            resultType: "command",
            status: "info",
            title: "Stampa Etichetta DHL Avviata 🖨️",
            message: `Inviata ristampa per ${activeOrder.orderNumber} (${colli} ${colli === 1 ? "collo" : "colli"}).`,
            timestamp: Date.now(),
          });
          return;
        }
      }

      if (!activeOrder) {
        if (!isMuted) playScanError();
        return;
      }

      // 2. Check if it's a Box Barcode (e.g. "BOX-NOR-M", "BOX-ZRE-M", "BOX-AMZ-M")
      const matchedBox = BOX_TYPES.find(
        (b) =>
          b.barcode.toUpperCase() === rawCode || b.id.toUpperCase() === rawCode,
      );
      if (matchedBox && activeOrder) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === activeOrder.id) {
              return {
                ...o,
                boxRecommendation: matchedBox.id as BoxType,
                boxBranding: matchedBox.branding,
              };
            }
            return o;
          }),
        );
        if (!isMuted) playScanSuccess();
        setLastScan({
          id: Math.random().toString(),
          rawCode,
          resultType: "box_selected",
          status: "info",
          title: "Scatola Assegnata",
          message: `Impostata ${matchedBox.name}`,
          timestamp: Date.now(),
        });
        return;
      }

      // 3. Check if it's a Marketing Flyer Barcode (e.g. "FLY-NOR-ITA", "FLY-ZRE-NUTRA", etc.)
      const matchedFlyer = MARKETING_FLYERS.find(
        (f) => f.code.toUpperCase() === rawCode,
      );
      if (matchedFlyer && activeOrder) {
        // Verify this flyer is actually required for the current order
        const isRequiredForOrder = activeOrder.marketingFlyers.some(
          (f) => f.code.toUpperCase() === rawCode || f.id === matchedFlyer.id,
        );

        if (!isRequiredForOrder) {
          if (!isMuted) playScanError();
          setLastScan({
            id: Math.random().toString(),
            rawCode,
            resultType: "unknown_code",
            status: "warning",
            title: "Volantino Non Richiesto",
            message: `Il volantino "${matchedFlyer.title}" non è previsto per questo ordine.`,
            timestamp: Date.now(),
          });
          return;
        }

        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === activeOrder.id) {
              const updatedFlyers = o.marketingFlyers.map((f) => {
                if (
                  f.code.toUpperCase() === rawCode ||
                  f.id === matchedFlyer.id
                ) {
                  return { ...f, isIncluded: true };
                }
                return f;
              });
              return { ...o, marketingFlyers: updatedFlyers };
            }
            return o;
          }),
        );
        if (!isMuted) playItemComplete();
        setLastScan({
          id: Math.random().toString(),
          rawCode,
          resultType: "flyer_match",
          status: "success",
          title: "Volantino Inserito ✓",
          message: `Confermato inserimento ${matchedFlyer.title} nella scatola!`,
          timestamp: Date.now(),
        });
        return;
      }

      // 4. Check if it's a Command Barcode (e.g. "CMD:PRINT-DHL", "CMD:COMPLETE")
      if (rawCode.startsWith("CMD:")) {
        if (rawCode === "CMD:PRINT-DHL" || rawCode === "CMD:COMPLETE") {
          const itemsOk = activeOrder.items.every(
            (i) => i.quantityScanned >= i.quantityRequired,
          );
          const flyersOk = activeOrder.marketingFlyers.every(
            (f) => f.isIncluded,
          );
          const giftOk =
            !activeOrder.retentionGift ||
            activeOrder.retentionGift === "none" ||
            !!activeOrder.giftConfirmed;
          const docOk =
            !activeOrder.requiresPhysicalDocument ||
            !!activeOrder.physicalDocumentConfirmed;

          if (itemsOk && flyersOk && giftOk && docOk) {
            setIsLabelModalOpen(true);
            if (!isMuted) playOrderComplete();
          } else {
            if (!isMuted) playScanError();
            setLastScan({
              id: Math.random().toString(),
              rawCode,
              resultType: "command",
              status: "warning",
              title: "Impossibile Stampare",
              message: `Scansiona prima tutti gli articoli mancanti e inserisci il volantino pubblicitario`,
              timestamp: Date.now(),
            });
          }
          return;
        }
      }

      // 5. Check if it's a Product EAN / SKU (with alias, UPC-12/EAN-13, and custom binding resolution)
      const matchedProduct = resolveProduct(rawCode, productsList);

      if (!matchedProduct) {
        if (!isMuted) playScanError();
        setUnboundBarcode(code);
        setLastScan({
          id: Math.random().toString(),
          rawCode: code,
          resultType: "unknown_code",
          status: "error",
          title: "Codice Sconosciuto",
          message: `Nessun articolo corrispondente per [${code}]. Tocca per associarlo al catalogo.`,
          timestamp: Date.now(),
        });
        return;
      }

      // Is this product part of the active order? (match by ID, SKU, EAN or alias)
      const itemIndex = activeOrder.items.findIndex(
        (it) =>
          it.product.id === matchedProduct.id ||
          it.product.sku === matchedProduct.sku ||
          it.product.ean === matchedProduct.ean ||
          (matchedProduct.aliases &&
            matchedProduct.aliases.includes(it.product.ean)),
      );

      if (itemIndex === -1) {
        // Find if this product belongs to any other pending order in the queue
        const otherOrder = orders.find(
          (o) =>
            o.id !== activeOrder.id &&
            o.status !== "packed" &&
            o.status !== "shipped" &&
            o.items.some(
              (it) =>
                (it.product.id === matchedProduct.id ||
                  it.product.sku === matchedProduct.sku ||
                  it.product.ean === matchedProduct.ean ||
                  (matchedProduct.aliases &&
                    matchedProduct.aliases.includes(it.product.ean))) &&
                it.quantityScanned < it.quantityRequired,
            ),
        );

        if (!isMuted) playScanError();
        blinkWrongScan(matchedProduct.p2lTier, matchedProduct.p2lLedIndex);
        setKpis((prev) => ({
          ...prev,
          errorsPrevented: prev.errorsPrevented + 1,
        }));

        setLastScan({
          id: Math.random().toString(),
          rawCode: code,
          resultType: "wrong_product",
          status: otherOrder ? "warning" : "error",
          title: otherOrder
            ? "PRODOTTO PER ALTRO ORDINE"
            : "ERRORE PRODOTTO NON INCLUSO",
          message: otherOrder
            ? `${matchedProduct.name} non è in ${activeOrder.orderNumber}, ma è nell'ordine ${otherOrder.orderNumber} (${otherOrder.customerName})!`
            : `Attenzione! ${matchedProduct.name} non appartiene a questo ordine. Riporre nello scaffale [${matchedProduct.shelfLocation}]`,
          timestamp: Date.now(),
          matchedProduct,
          otherOrderCandidate: otherOrder
            ? {
                orderId: otherOrder.id,
                orderNumber: otherOrder.orderNumber,
                customerName: otherOrder.customerName,
              }
            : undefined,
        });
        return;
      }

      // Item belongs to active order -> check quantity
      const currentItem = activeOrder.items[itemIndex];
      if (currentItem.quantityScanned >= currentItem.quantityRequired) {
        // Overpack attempt
        if (!isMuted) playScanError();
        setLastScan({
          id: Math.random().toString(),
          rawCode: code,
          resultType: "overpack",
          status: "warning",
          title: "Quantità Massima Già Raggiunta",
          message: `Tutti i ${currentItem.quantityRequired} pezzi di ${matchedProduct.name} sono già stati scansionati!`,
          timestamp: Date.now(),
          matchedProduct,
        });
        return;
      }

      // SUCCESSFUL PRODUCT SCAN (+quantityToAdd)
      const availableToAdd =
        currentItem.quantityRequired - currentItem.quantityScanned;
      const actualAdd = Math.max(1, Math.min(quantityToAdd, availableToAdd));
      const newScannedQty = currentItem.quantityScanned + actualAdd;
      const isItemDone = newScannedQty >= currentItem.quantityRequired;

      // Update state with FEFO Lot & Expiry traceability
      const activeLotInfo = getProductLotInfo(matchedProduct);
      setOrders((prev) =>
        prev.map((ord) => {
          if (ord.id === activeOrder.id) {
            const updatedItems: OrderItem[] = ord.items.map((it, idx) => {
              if (idx === itemIndex) {
                return {
                  ...it,
                  quantityScanned: newScannedQty,
                  status: isItemDone ? "completed" : "in_progress",
                  lotNumber: it.lotNumber || activeLotInfo.lotNumber,
                  expiryDate: it.expiryDate || activeLotInfo.expiryDate,
                };
              }
              return it;
            });
            return { ...ord, items: updatedItems };
          }
          return ord;
        }),
      );

      // Async sync to SQLite backend
      updateOrderItemScannedApi(
        activeOrder.id,
        matchedProduct.id,
        newScannedQty,
        isItemDone ? "completed" : "in_progress",
      ).catch(() => {});

      // Check if entire order is now 100% complete (strict Poka-Yoke item-by-item check)
      const itemsDone = activeOrder.items.every((it, idx) => {
        const scanned = idx === itemIndex ? newScannedQty : it.quantityScanned;
        return scanned >= it.quantityRequired;
      });
      const flyersOk = activeOrder.marketingFlyers.every((f) => f.isIncluded);
      const giftOk =
        !activeOrder.retentionGift ||
        activeOrder.retentionGift === "none" ||
        !!activeOrder.giftConfirmed;
      const docOk =
        !activeOrder.requiresPhysicalDocument ||
        !!activeOrder.physicalDocumentConfirmed;
      const isOrderDone = itemsDone && flyersOk && giftOk && docOk;

      if (isOrderDone) {
        if (!isMuted) playOrderComplete();
        clearOrderLeds(activeOrder); // Turn off all shelf LEDs
        setLastScan({
          id: Math.random().toString(),
          rawCode: code,
          resultType: "product_match",
          status: "success",
          title: "ORDINE COMPLETATO ✓",
          message: `Tutti i prodotti verificati. L'etichetta DHL è già stata stampata all'avvio. Scansiona il prossimo foglio per avanzare.`,
          timestamp: Date.now(),
          matchedProduct,
        });
      } else if (isItemDone) {
        if (!isMuted) playItemComplete();
        markProductScanned(matchedProduct.p2lTier, matchedProduct.p2lLedIndex); // Turn off this product LED
        setLastScan({
          id: Math.random().toString(),
          rawCode: code,
          resultType: "product_match",
          status: "success",
          title:
            actualAdd > 1
              ? `CARTONE MASTER (+${actualAdd} PZ) ✓`
              : "Posizione Completata",
          message: `${matchedProduct.name} completato (${newScannedQty}/${currentItem.quantityRequired} pz). Posizione: [${matchedProduct.shelfLocation}]`,
          timestamp: Date.now(),
          matchedProduct,
        });
      } else {
        if (!isMuted) playScanSuccess();
        setLastScan({
          id: Math.random().toString(),
          rawCode: code,
          resultType: "product_match",
          status: "success",
          title:
            actualAdd > 1
              ? `CARTONE MASTER (+${actualAdd} PZ)`
              : `SCANSIONE CORRETTA (+1)`,
          message: `Registrato ${matchedProduct.name} (+${actualAdd} pz: ${newScannedQty}/${currentItem.quantityRequired}). Posizione: [${matchedProduct.shelfLocation}]`,
          timestamp: Date.now(),
          matchedProduct,
        });
      }
    },
    [
      orders,
      activeOrder,
      operators,
      productsList,
      isMuted,
      playScanSuccess,
      playScanError,
      playItemComplete,
      playOrderComplete,
    ],
  );

  // Hook for global keyboard scanner interception (paused when blocking modals are open)
  // Note: isLabelModalOpen does NOT block the scanner so operator can scan the next order slip immediately
  const isAnyModalBlockingScanner =
    isIssueModalOpen ||
    isOperatorAuthOpen ||
    isSupervisorPinModalOpen ||
    isSellyModalOpen ||
    isBindModalOpen ||
    isRackGuideOpen;

  const { triggerManualScan } = useBarcodeScanner({
    onScan: handleBarcodeScanned,
    disabled: isAnyModalBlockingScanner,
  });

  // Finish order and advance to next
  const handleCompleteAndNext = () => {
    setIsLabelModalOpen(false);
    if (!activeOrder || activeOrder.status === "packed") {
      return;
    }

    // If timing is set to print on finish, print the DHL label now with exact final package count
    if (dhlPrintTiming === "on_finish") {
      printDhlThermalLabel(activeOrder, activeOrder.packageCount || 1);
    }

    const completedOrderId = activeOrder.id;

    // Mark current order as packed
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === completedOrderId) {
          return { ...o, status: "packed", packingCompletedAt: Date.now() };
        }
        return o;
      }),
    );

    // Deduct packed items from packing shelf stock (if Phase 2-3 enabled) & sync packed status to SQLite
    if (WMS_PHASE_CONFIG.ENABLE_WAREHOUSE_INVENTORY_ERP) {
      deductPackedOrderFromShelf(
        productsList,
        activeOrder.items.map((it) => ({
          sku: it.product.sku,
          quantity: it.quantityRequired,
        })),
      );
    }
    updateOrderStatusApi(
      completedOrderId,
      "packed",
      currentOperator.id,
      stationConfigId,
    ).catch(() => {});

    // Update KPI
    setKpis((prev) => ({
      ...prev,
      totalPackedToday: prev.totalPackedToday + 1,
      unitsPerHour: Math.round((prev.unitsPerHour + 1.2) * 10) / 10,
    }));

    // Update Station packed count
    setStations((prev) =>
      prev.map((st) => {
        if (st.id === currentOperator.stationId) {
          return { ...st, ordersPackedToday: st.ordersPackedToday + 1 };
        }
        return st;
      }),
    );

    // Find next ready order
    const nextOrder = orders.find(
      (o) => o.id !== completedOrderId && o.status !== "packed",
    );
    if (nextOrder) {
      setActiveOrderId(nextOrder.id);
      setLastScan({
        id: Math.random().toString(),
        rawCode: nextOrder.barcode,
        resultType: "order_switch",
        status: "info",
        title: "Nuovo Ordine Caricato",
        message: `Caricato automaticamente ${nextOrder.orderNumber} per ${nextOrder.customerName}`,
        timestamp: Date.now(),
      });
    }
  };

  const handleLoadDemoOrders = useCallback(() => {
    setOrders(INITIAL_ORDERS);
    setActiveOrderId(INITIAL_ORDERS[0]?.id || "");
    saveBulkOrdersApi(INITIAL_ORDERS, true).catch(() => {});
    if (!isMuted) playScanSuccess();
    setLastScan({
      id: Math.random().toString(),
      rawCode: "DEMO-LOAD",
      resultType: "order_switch",
      status: "info",
      title: "Modalità Simulazione / Formazione",
      message: `Caricati ${INITIAL_ORDERS.length} ordini dimostrativi per il training degli operatori.`,
      timestamp: Date.now(),
    });
  }, [isMuted, playScanSuccess]);

  const handleClearOrders = useCallback(() => {
    setOrders([]);
    setActiveOrderId("");
    localStorage.removeItem("wms_orders");
    localStorage.setItem("wms_orders_prod_v1", "[]");
    localStorage.removeItem("wms_active_order_id");
    localStorage.removeItem("wms_active_order_id_prod_v1");
    clearPackedOrdersApi().catch(() => {});
    if (!isMuted) playScanSuccess();
    setLastScan({
      id: Math.random().toString(),
      rawCode: "QUEUE-CLEARED",
      resultType: "command",
      status: "info",
      title: "Coda Ordini Azzerata",
      message: "Postazione pronta per nuova distinta Selly ERP.",
      timestamp: Date.now(),
    });
  }, [isMuted, playScanSuccess]);

  const handleResetData = useCallback(() => {
    if (
      window.confirm(
        "Attenzione: Vuoi azzerare la coda degli ordini per iniziare un nuovo turno di lavoro?",
      )
    ) {
      handleClearOrders();
    }
  }, [handleClearOrders]);

  const [pendingAutoScan, setPendingAutoScan] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingAutoScan) return;
    const code = pendingAutoScan;
    setPendingAutoScan(null);
    handleBarcodeScanned(code);
  }, [pendingAutoScan, handleBarcodeScanned]);

  const handleQuickSwitchOrder = useCallback(
    (targetOrderId: string, autoScanBarcode?: string) => {
      setActiveOrderId(targetOrderId);
      if (!isMuted) playScanSuccess();
      const targetOrder = orders.find((o) => o.id === targetOrderId);
      setLastScan({
        id: Math.random().toString(),
        rawCode: targetOrder?.orderNumber || targetOrderId,
        resultType: "order_switch",
        status: "info",
        title: "Passaggio Rapido Ordine",
        message: `Aperto ordine ${targetOrder?.orderNumber || targetOrderId} (${targetOrder?.customerName})`,
        timestamp: Date.now(),
      });
      if (autoScanBarcode) setPendingAutoScan(autoScanBarcode);
    },
    [orders, isMuted, playScanSuccess],
  );

  const handleForceAddProductToActiveOrder = useCallback(
    (product: Product) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === activeOrderId) {
            const existingItem = o.items.find(
              (it) => it.product.id === product.id || it.product.sku === product.sku,
            );
            if (existingItem) {
              return {
                ...o,
                items: o.items.map((it) =>
                  it.product.id === product.id || it.product.sku === product.sku
                    ? {
                        ...it,
                        quantityScanned: it.quantityScanned + 1,
                        quantityRequired: Math.max(it.quantityRequired, it.quantityScanned + 1),
                        status: "completed" as const,
                      }
                    : it,
                ),
              };
            } else {
              return {
                ...o,
                items: [
                  ...o.items,
                  {
                    product,
                    quantityRequired: 1,
                    quantityScanned: 1,
                    status: "completed" as const,
                  },
                ],
              };
            }
          }
          return o;
        }),
      );

      if (!isMuted) playItemComplete();
      setLastScan({
        id: Math.random().toString(),
        rawCode: product.ean,
        resultType: "product_match",
        status: "success",
        title: "Articolo Aggiunto (Test MVP)",
        message: `Aggiunto e convalidato: ${product.name} [${product.shelfLocation}]`,
        timestamp: Date.now(),
        matchedProduct: product,
      });
    },
    [activeOrderId, isMuted, playItemComplete],
  );

  const handleBindBarcode = useCallback(
    (barcode: string, targetSku: string) => {
      const clean = barcode.trim();
      try {
        const saved = localStorage.getItem("wms_custom_barcode_bindings");
        const bindings = saved ? JSON.parse(saved) : {};
        bindings[clean] = targetSku;
        localStorage.setItem("wms_custom_barcode_bindings", JSON.stringify(bindings));
      } catch {
        // fallback
      }

      setProductsList((prev) =>
        prev.map((p) => {
          if (p.sku === targetSku) {
            const updatedAliases = Array.from(new Set([...(p.aliases || []), clean]));
            return { ...p, aliases: updatedAliases };
          }
          return p;
        }),
      );

      handleBarcodeScanned(clean);
    },
    [handleBarcodeScanned],
  );

  const handleImportSellyOrders = useCallback(
    (newOrders: Order[], replaceExisting: boolean) => {
      if (replaceExisting) {
        setOrders(newOrders);
        if (newOrders.length > 0) setActiveOrderId(newOrders[0].id);
      } else {
        setOrders((prev) => [...newOrders, ...prev]);
        if (newOrders.length > 0) setActiveOrderId(newOrders[0].id);
      }

      // Persist to SQLite backend
      saveBulkOrdersApi(newOrders, replaceExisting).catch((err) => {
        console.warn("[WMS] Could not persist Selly orders to backend:", err);
      });

      if (!isMuted) playScanSuccess();
      setLastScan({
        id: Math.random().toString(),
        rawCode: `SELLY-IMPORT-${newOrders.length}`,
        resultType: "order_switch",
        status: "info",
        title: "Ordini Selly ERP Importati",
        message: `Caricati ${newOrders.length} ordini pronti per il confezionamento!`,
        timestamp: Date.now(),
      });
    },
    [isMuted, playScanSuccess],
  );

  const handleChangeBoxType = (boxType: BoxType) => {
    const matchedBox = BOX_TYPES.find((b) => b.id === boxType);
    const boxBranding = matchedBox ? matchedBox.branding : "norsan_logo";
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === activeOrderId) {
          return {
            ...o,
            boxRecommendation: boxType,
            boxBranding,
          };
        }
        return o;
      }),
    );

    // Sync to SQLite backend
    if (activeOrderId) {
      updateOrderBoxApi(activeOrderId, boxType, boxBranding).catch(() => {});
    }
  };

  const handleUpdatePackageCount = useCallback(
    (orderId: string, count: number) => {
      const validCount = Math.max(1, count);
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              packageCount: validCount,
            };
          }
          return o;
        }),
      );
      updatePackageCountApi(orderId, validCount).catch(() => {});
      if (!isMuted) playScanSuccess();
    },
    [isMuted, playScanSuccess],
  );

  const handleSubmitIssue = (type: string, note: string) => {
    const newIssue: IssueTicket = {
      id: `iss-${Date.now()}`,
      orderNumber: activeOrder?.orderNumber || "N/A",
      stationId: currentOperator.stationId,
      operatorName: currentOperator.name,
      type,
      note,
      timestamp: Date.now(),
      status: "pending",
    };

    setIssues((prev) => [newIssue, ...prev]);

    setLastScan({
      id: Math.random().toString(),
      rawCode: "ISSUE-REPORTED",
      resultType: "command",
      status: "warning",
      title: "Segnalazione Inviata al Team Lead",
      message: `Anomalia "${type}" notificata alla dashboard di direzione.`,
      timestamp: Date.now(),
    });
  };

  const handleResolveIssue = (issueId: string) => {
    setIssues((prev) =>
      prev.map((i) => {
        if (i.id === issueId) {
          return { ...i, status: "resolved" };
        }
        return i;
      }),
    );
    if (!isMuted) playScanSuccess();
  };

  const handleUpdateOrderAddress = useCallback(
    (orderId: string, updatedFields: any) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              ...updatedFields,
              addressStatus: updatedFields.addressDetails?.status || "valid",
            };
          }
          return o;
        }),
      );
      if (!isMuted) playScanSuccess();
    },
    [isMuted, playScanSuccess],
  );

  const handleSwitchToStation = (_stationId: string) => {
    setActiveView("packing");
  };

  // Handle Toggle View with RBAC check
  const handleToggleView = useCallback(() => {
    if (activeView === "supervisor") {
      setActiveView("packing");
    } else {
      if (
        currentOperator.role === "team_lead" ||
        currentOperator.role === "supervisor"
      ) {
        setActiveView("supervisor");
      } else {
        setIsSupervisorPinModalOpen(true);
      }
    }
  }, [activeView, currentOperator]);

  const handleSupervisorPinSuccess = useCallback((leadOp?: Operator) => {
    if (leadOp) {
      setCurrentOperator(leadOp);
    }
    setActiveView("supervisor");
  }, []);

  const handleLockTerminal = useCallback(() => {
    setIsTerminalLocked(true);
    setActiveView("packing");
  }, []);

  const handleLoginFromLockScreen = useCallback(
    (operator: Operator) => {
      setCurrentOperator(operator);
      setIsTerminalLocked(false);
      if (!isMuted) playScanSuccess();
      setLastScan({
        id: Math.random().toString(),
        rawCode: operator.operatorCode,
        resultType: "operator_login",
        status: "info",
        title: "Login Riuscito",
        message: `Benvenuto ${operator.name} [${operator.operatorCode}] • Ruolo: ${operator.role === "team_lead" ? "Team Lead" : "Packer"}`,
        timestamp: Date.now(),
      });
    },
    [isMuted, playScanSuccess],
  );

  return {
    activeView,
    setActiveView,
    operators,
    currentOperator,
    setCurrentOperator,
    stations,
    setStations,
    stationConfigId,
    setStationConfigId,
    orders,
    setOrders,
    activeOrderId,
    setActiveOrderId,
    lastScan,
    isMuted,
    setIsMuted,
    productsList,
    slotsList,
    issues,
    kpis,
    setKpis,
    isRackGuideOpen,
    setIsRackGuideOpen,
    isSimulatorOpen,
    setIsSimulatorOpen,
    isLabelModalOpen,
    setIsLabelModalOpen,
    isIssueModalOpen,
    setIsIssueModalOpen,
    isOperatorAuthOpen,
    setIsOperatorAuthOpen,
    isTerminalLocked,
    setIsTerminalLocked,
    isSupervisorPinModalOpen,
    setIsSupervisorPinModalOpen,
    isSellyModalOpen,
    setIsSellyModalOpen,
    isBindModalOpen,
    setIsBindModalOpen,
    unboundBarcode,
    setUnboundBarcode,

    handleAssignSlot,
    handleAddSlot,
    handleDeleteSlot,
    handleAddOperator,
    handleUpdateOperator,
    handleDeleteOperator,
    handleSubmitIssue,
    handleResolveIssue,
    handleToggleFlyer,
    handleToggleGift,
    handleTogglePhysicalDocument,
    handleConfirmAllItems,
    handleUpdateItemLot,
    handleSimulateIncomingWebOrder,
    handleBarcodeScanned,
    handleCompleteAndNext,
    handleResetData,
    handleLoadDemoOrders,
    handleClearOrders,
    handleChangeBoxType,
    handleUpdatePackageCount,
    handleSwitchToStation,
    handleToggleView,
    handleSupervisorPinSuccess,
    handleLockTerminal,
    handleLoginFromLockScreen,
    handleQuickSwitchOrder,
    handleForceAddProductToActiveOrder,
    handleBindBarcode,
    handleImportSellyOrders,
    handleUpdateOrderAddress,
    handleUpdateProductImage,
    handleResetSlotsToDefault,
    triggerManualScan,
    leadOperators,
    isTeamLead,
    activeOrder,
    dhlPrintTiming,
    toggleDhlPrintTiming,
  };
}
