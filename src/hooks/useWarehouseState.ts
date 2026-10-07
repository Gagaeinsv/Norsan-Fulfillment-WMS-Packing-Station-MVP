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
} from "../services/api";
import {
  WarehouseSlotData,
  generateBolzanoDefaultSlots,
} from "../components/rack/rackTypes";
import { useBarcodeScanner } from "./useBarcodeScanner";
import { useSoundEffects } from "./useSoundEffects";

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
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem("wms_orders");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_ORDERS;
  });

  useEffect(() => {
    localStorage.setItem("wms_orders", JSON.stringify(orders));
  }, [orders]);

  const [activeOrderId, setActiveOrderId] = useState<string>(() => {
    const saved = localStorage.getItem("wms_active_order_id");
    if (saved && orders.some((o) => o.id === saved)) return saved;
    return orders[0]?.id || INITIAL_ORDERS[0].id;
  });

  useEffect(() => {
    localStorage.setItem("wms_active_order_id", activeOrderId);
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

  // Modals for Selly ERP CSV import and Barcode Binding
  const [isSellyModalOpen, setIsSellyModalOpen] = useState(false);
  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [unboundBarcode, setUnboundBarcode] = useState<string>("");

  // Load live DB data from SQLite backend on mount
  useEffect(() => {
    const customImgs = getCustomProductImages();
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

  // Add a new operator
  const handleAddOperator = useCallback((newOp: Operator) => {
    setOperators((prev) => [...prev, newOp]);
  }, []);

  // Update an existing operator / lead
  const handleUpdateOperator = useCallback((updatedOp: Operator) => {
    setOperators((prev) =>
      prev.map((op) => (op.id === updatedOp.id ? updatedOp : op)),
    );
    setCurrentOperator((prev) => (prev.id === updatedOp.id ? updatedOp : prev));
  }, []);

  // Delete an operator (with active operator safety)
  const handleDeleteOperator = useCallback((opId: string) => {
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
  const [issues, setIssues] = useState<IssueTicket[]>([
    {
      id: "iss-1",
      orderNumber: "ORD-2026-8809",
      stationId: "ST-01",
      operatorName: "Matteo Rossi",
      type: "Scorta esaurita sullo scaffale",
      note: "Slot S2-A (Total Limone 200ml) richiede bancale di rifornimento",
      timestamp: Date.now() - 1000 * 60 * 18,
      status: "pending",
    },
  ]);

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

  // KPIs
  const [kpis, setKpis] = useState<StationKPIs>({
    totalPackedToday: 24,
    unitsPerHour: 48.5,
    accuracyPercentage: 100,
    errorsPrevented: 3,
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

      // 0. Check if it's an Operator Badge Barcode (e.g. "OP-042", "OP-018", "TL-001")
      const matchedOperator = operators.find(
        (op) => op.operatorCode.toUpperCase() === rawCode,
      );
      if (matchedOperator) {
        setCurrentOperator(matchedOperator);
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
        setActiveOrderId(matchedOrder.id);
        if (!isMuted) playScanSuccess();
        setLastScan({
          id: Math.random().toString(),
          rawCode,
          resultType: "order_switch",
          status: "info",
          title: "Foglio d'Ordine Caricato",
          message: `Aperto ordine ${matchedOrder.orderNumber} per ${matchedOrder.customerName} (${matchedOrder.customerCity})`,
          timestamp: Date.now(),
        });
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

      // Update state
      setOrders((prev) =>
        prev.map((ord) => {
          if (ord.id === activeOrder.id) {
            const updatedItems: OrderItem[] = ord.items.map((it, idx) => {
              if (idx === itemIndex) {
                return {
                  ...it,
                  quantityScanned: newScannedQty,
                  status: isItemDone ? "completed" : "in_progress",
                };
              }
              return it;
            });
            return { ...ord, items: updatedItems };
          }
          return ord;
        }),
      );

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
        setIsLabelModalOpen(true);
        setLastScan({
          id: Math.random().toString(),
          rawCode: code,
          resultType: "product_match",
          status: "success",
          title: "ORDINE COMPLETATO AL 100%",
          message: `Tutti i prodotti e volantini verificati! Pronto per la stampa dell'etichetta ${activeOrder.courier}.`,
          timestamp: Date.now(),
          matchedProduct,
        });
      } else if (isItemDone) {
        if (!isMuted) playItemComplete();
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

  // Hook for global keyboard scanner interception
  const { triggerManualScan } = useBarcodeScanner({
    onScan: handleBarcodeScanned,
  });

  // Finish order and advance to next
  const handleCompleteAndNext = () => {
    setIsLabelModalOpen(false);

    // Mark current order as packed
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === activeOrderId) {
          return { ...o, status: "packed", packingCompletedAt: Date.now() };
        }
        return o;
      }),
    );

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
      (o) => o.id !== activeOrderId && o.status !== "packed",
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

  const handleResetData = () => {
    localStorage.removeItem("wms_orders");
    localStorage.removeItem("wms_active_order_id");
    localStorage.removeItem("wms_custom_barcode_bindings");
    setOrders(INITIAL_ORDERS);
    setActiveOrderId(INITIAL_ORDERS[0].id);
    setLastScan(null);
  };

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
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === activeOrderId) {
          return {
            ...o,
            boxRecommendation: boxType,
            boxBranding: matchedBox ? matchedBox.branding : o.boxBranding,
          };
        }
        return o;
      }),
    );
  };

  const handleSubmitIssue = (type: string, note: string) => {
    const newIssue: IssueTicket = {
      id: `iss-${Date.now()}`,
      orderNumber: activeOrder.orderNumber,
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
    handleSimulateIncomingWebOrder,
    handleBarcodeScanned,
    handleCompleteAndNext,
    handleResetData,
    handleChangeBoxType,
    handleSwitchToStation,
    handleToggleView,
    handleSupervisorPinSuccess,
    handleLockTerminal,
    handleLoginFromLockScreen,
    handleQuickSwitchOrder,
    handleForceAddProductToActiveOrder,
    handleBindBarcode,
    handleImportSellyOrders,
    handleUpdateProductImage,
    handleResetSlotsToDefault,
    triggerManualScan,
    leadOperators,
    isTeamLead,
    activeOrder: orders.find((o) => o.id === activeOrderId),
  };
}
