
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Operator, Order, OrderItem, WarehouseStation, ScanEvent, Product, IssueTicket, BoxType, StationKPIs } from '../types/wms';
import { MARKETING_FLYERS, BOX_TYPES } from '../data/marketingFlyers';
import { NORSAN_PRODUCTS } from '../data/norsanProducts';
import { INITIAL_ORDERS } from '../data/mockOrders';
import { INITIAL_STATIONS, OPERATORS } from '../data/mockOperators';
import { fetchProducts, fetchWarehouseSlots, updateSlotAssignment, addNewSlot, deleteSlot } from '../services/api';
import { WarehouseSlotData } from '../components/supervisor/SlottingManager';
import { useBarcodeScanner } from './useBarcodeScanner';
import { useSoundEffects } from './useSoundEffects';

export function useWarehouseState() {
  const [activeView, setActiveView] = useState<'packing' | 'supervisor'>('packing');
  const [operators, setOperators] = useState<Operator[]>(OPERATORS);
  const [currentOperator, setCurrentOperator] = useState<Operator>(OPERATORS[0]); // Serhii Haharin
  const [stations, setStations] = useState<WarehouseStation[]>(INITIAL_STATIONS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [activeOrderId, setActiveOrderId] = useState<string>(INITIAL_ORDERS[0].id);
  const [stationConfigId, setStationConfigId] = useState<string>(() => {
    return localStorage.getItem('stationConfigId') || 'STATION_01';
  });

  useEffect(() => {
    localStorage.setItem('stationConfigId', stationConfigId);
  }, [stationConfigId]);
  const [lastScan, setLastScan] = useState<ScanEvent | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [productsList, setProductsList] = useState<Product[]>(NORSAN_PRODUCTS);
  const [slotsList, setSlotsList] = useState<WarehouseSlotData[]>([]);

  // Load live DB data from SQLite backend on mount
  useEffect(() => {
    fetchProducts().then(prods => {
      if (prods && prods.length > 0) setProductsList(prods);
    });
    fetchWarehouseSlots().then(slots => {
      if (slots && slots.length > 0) setSlotsList(slots);
    });
  }, []);

  // Handle dynamic slot reassignment (5S Slotting Manager)
  const handleAssignSlot = useCallback(async (slotCode: string, productId: string | null) => {
    await updateSlotAssignment(slotCode, productId);
    const updatedSlots = await fetchWarehouseSlots();
    setSlotsList(updatedSlots);
    const updatedProds = await fetchProducts();
    setProductsList(updatedProds);

    // Update active orders with new shelf coordinates
    setOrders(prev => prev.map(ord => ({
      ...ord,
      items: ord.items.map(it => {
        const matchingProd = updatedProds.find(p => p.id === it.product.id || p.ean === it.product.ean);
        if (matchingProd) {
          return {
            ...it,
            product: {
              ...it.product,
              shelfLocation: matchingProd.shelfLocation,
              rackSide: matchingProd.rackSide,
              tier: matchingProd.tier
            }
          };
        }
        return it;
      })
    })));
  }, []);

  // Add a new slot to a tier with instant optimistic UI update
  const handleAddSlot = useCallback(async (side: 'S' | 'D', tier: 1 | 2 | 3) => {
    const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
    const existingCodes = new Set(slotsList.filter(s => s.side === side && Number(s.tier) === Number(tier)).map(s => s.slot_code));
    const nextLetter = alphabet.find(l => !existingCodes.has(`${side}${tier}-${l}`)) || `X${existingCodes.size + 1}`;
    const newSlotCode = `${side}${tier}-${nextLetter}`;

    const newSlotObj: WarehouseSlotData = {
      slot_code: newSlotCode,
      side: side,
      tier: tier,
      description: `Scaffale ${side} • Piano ${tier} • Slot ${newSlotCode}`,
      product_id: null
    };

    // Instant optimistic update
    setSlotsList(prev => [...prev, newSlotObj]);

    // Persist to backend database
    try {
      await addNewSlot(newSlotCode, side, tier);
      const updatedSlots = await fetchWarehouseSlots();
      if (updatedSlots && updatedSlots.length > 0) {
        setSlotsList(updatedSlots);
      }
    } catch (_e) {
      console.warn('Backend sync failed, state preserved locally');
    }
  }, [slotsList]);

  // Delete a slot with instant optimistic UI update
  const handleDeleteSlot = useCallback(async (slotCode: string) => {
    // Instant optimistic update
    setSlotsList(prev => prev.filter(s => s.slot_code !== slotCode));

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
      console.warn('Backend sync failed, state preserved locally');
    }
  }, []);

  // Add a new operator
  const handleAddOperator = useCallback((newOp: Operator) => {
    setOperators(prev => [...prev, newOp]);
  }, []);

  // Update an existing operator / lead
  const handleUpdateOperator = useCallback((updatedOp: Operator) => {
    setOperators(prev => prev.map(op => op.id === updatedOp.id ? updatedOp : op));
    setCurrentOperator(prev => prev.id === updatedOp.id ? updatedOp : prev);
  }, []);

  // Delete an operator (with active operator safety)
  const handleDeleteOperator = useCallback((opId: string) => {
    setOperators(prev => {
      const remaining = prev.filter(op => op.id !== opId);
      setCurrentOperator(current => {
        if (current.id === opId) {
          if (remaining.length > 0) {
            return remaining[0];
          }
          // If no operators remain, lock terminal
          setIsTerminalLocked(true);
          setActiveView('packing');
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
      id: 'iss-1',
      orderNumber: 'ORD-2026-8809',
      stationId: 'ST-01',
      operatorName: 'Matteo Rossi',
      type: 'Scorta esaurita sullo scaffale',
      note: 'Slot S2-A (Total Limone 200ml) richiede bancale di rifornimento',
      timestamp: Date.now() - 1000 * 60 * 18,
      status: 'pending',
    }
  ]);

  // Modals & Security state
  const [isRackGuideOpen, setIsRackGuideOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isOperatorAuthOpen, setIsOperatorAuthOpen] = useState(false);
  const [isTerminalLocked, setIsTerminalLocked] = useState(true);
  const [isSupervisorPinModalOpen, setIsSupervisorPinModalOpen] = useState(false);

  const leadOperators = useMemo(() => {
    return operators.filter(o => o.role === 'team_lead' || o.role === 'supervisor');
  }, [operators]);

  // True when the logged-in operator has edit rights (team lead or supervisor)
  const isTeamLead = currentOperator.role === 'team_lead' || currentOperator.role === 'supervisor';

  // KPIs
  const [kpis, setKpis] = useState<StationKPIs>({
    totalPackedToday: 24,
    unitsPerHour: 48.5,
    accuracyPercentage: 100,
    errorsPrevented: 3,
    activeOrderTimeSeconds: 0,
  });

  const { playScanSuccess, playItemComplete, playScanError, playOrderComplete } = useSoundEffects();

  const activeOrder = useMemo(() => {
    return orders.find(o => o.id === activeOrderId) || orders[0];
  }, [orders, activeOrderId]);

  // Toggle marketing flyer inclusion
  const handleToggleFlyer = useCallback((flyerId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === activeOrderId) {
        const updatedFlyers = o.marketingFlyers.map(f => {
          if (f.id === flyerId) {
            return { ...f, isIncluded: !f.isIncluded };
          }
          return f;
        });
        return { ...o, marketingFlyers: updatedFlyers };
      }
      return o;
    }));
    if (!isMuted) playScanSuccess();
  }, [activeOrderId, isMuted, playScanSuccess]);

  // Toggle retention gift confirmation
  const handleToggleGift = useCallback(() => {
    setOrders(prev => prev.map(o => {
      if (o.id === activeOrderId) {
        return { ...o, giftConfirmed: !o.giftConfirmed };
      }
      return o;
    }));
    if (!isMuted) playScanSuccess();
  }, [activeOrderId, isMuted, playScanSuccess]);

  // Toggle physical document confirmation
  const handleTogglePhysicalDocument = useCallback(() => {
    setOrders(prev => prev.map(o => {
      if (o.id === activeOrderId) {
        return { ...o, physicalDocumentConfirmed: !o.physicalDocumentConfirmed };
      }
      return o;
    }));
    if (!isMuted) playScanSuccess();
  }, [activeOrderId, isMuted, playScanSuccess]);

  // Simulate Incoming Web Order from norsan.it
  const handleSimulateIncomingWebOrder = useCallback(() => {
    const webOrderNum = `ORD-2026-${Math.floor(8820 + Math.random() * 80)}`;
    const italianCities = [
      { name: 'Firenze', zip: '50122', prov: 'FI', addr: 'Via de\' Tornabuoni 14', cust: 'Prof. Andrea Conti' },
      { name: 'Venezia', zip: '30124', prov: 'VE', addr: 'Fondamenta Zattere 78', cust: 'Chiara Moretti' },
      { name: 'Napoli', zip: '80121', prov: 'NA', addr: 'Via Chiaia 192', cust: 'Dott. Salvatore Esposito' },
      { name: 'Bologna', zip: '40126', prov: 'BO', addr: 'Via dell\'Indipendenza 55', cust: 'Laura Barbieri' },
    ];
    const pickedCity = italianCities[Math.floor(Math.random() * italianCities.length)];

    const newOrder: Order = {
      id: `ord-web-${Date.now()}`,
      orderNumber: webOrderNum,
      barcode: webOrderNum,
      source: 'norsan.it Web Shop',
      createdAt: Date.now(),
      customerName: pickedCity.cust,
      customerAddress: pickedCity.addr,
      customerCity: pickedCity.name,
      customerZip: pickedCity.zip,
      customerProvince: pickedCity.prov,
      customerCountry: 'IT',
      courier: 'DHL Express',
      trackingNumber: `JJD0184920019${Math.floor(100000 + Math.random() * 900000)}`,
      priority: 'express',
      boxBranding: 'norsan_logo',
      boxRecommendation: 'BOX-NOR-M',
      marketingFlyers: [
        { ...MARKETING_FLYERS[0], isIncluded: false }
      ],
      status: 'ready_to_pack',
      isSubscription: false,
      customerOrderCount: 1,
      retentionGift: 'none',
      specialNotes: 'ORDINE ONLINE DIRETTO DA NORSAN.IT • Scatola Logo NORSAN + Volantino Guida 2026',
      items: [
        {
          product: NORSAN_PRODUCTS[0], // Total Limone 200ml (Slot S2-A)
          quantityRequired: 2,
          quantityScanned: 0,
          status: 'pending',
        },
        {
          product: NORSAN_PRODUCTS[9], // Vitamina D3+K2 Gocce (Slot D3-A)
          quantityRequired: 1,
          quantityScanned: 0,
          status: 'pending',
        }
      ]
    };

    setOrders(prev => [newOrder, ...prev]);
    if (!isMuted) playScanSuccess();
    setLastScan({
      id: Math.random().toString(),
      rawCode: newOrder.barcode,
      resultType: 'order_switch',
      status: 'info',
      title: 'Nuovo Ordine Ricevuto da norsan.it',
      message: `Ricevuto ${newOrder.orderNumber} per ${newOrder.customerName} (${newOrder.customerCity}) via Webhook API!`,
      timestamp: Date.now(),
    });
  }, [isMuted, playScanSuccess]);

  // Main Barcode Processing Engine
  const handleBarcodeScanned = useCallback((code: string, quantityToAdd: number = 1) => {
    const rawCode = code.trim().toUpperCase();

    // 0. Check if it's an Operator Badge Barcode (e.g. "OP-042", "OP-018", "TL-001")
    const matchedOperator = operators.find(op => op.operatorCode.toUpperCase() === rawCode);
    if (matchedOperator) {
      setCurrentOperator(matchedOperator);
      setIsTerminalLocked(false);
      setIsSupervisorPinModalOpen(false);
      if (!isMuted) playScanSuccess();
      setLastScan({
        id: Math.random().toString(),
        rawCode,
        resultType: 'operator_login',
        status: 'info',
        title: 'Login Operatore Riuscito',
        message: `Autenticato: ${matchedOperator.name} [${matchedOperator.operatorCode}] • Ruolo: ${matchedOperator.role === 'team_lead' ? 'Team Lead' : 'Packer'}`,
        timestamp: Date.now(),
      });
      return;
    }

    // 1. Check if it's an Order Barcode (e.g. "ORD-2026-8812")
    const matchedOrder = orders.find(
      o => o.barcode.toUpperCase() === rawCode || o.orderNumber.toUpperCase() === rawCode
    );

    if (matchedOrder) {
      setActiveOrderId(matchedOrder.id);
      if (!isMuted) playScanSuccess();
      setLastScan({
        id: Math.random().toString(),
        rawCode,
        resultType: 'order_switch',
        status: 'info',
        title: 'Foglio d\'Ordine Caricato',
        message: `Aperto ordine ${matchedOrder.orderNumber} per ${matchedOrder.customerName} (${matchedOrder.customerCity})`,
        timestamp: Date.now(),
      });
      return;
    }

    // 2. Check if it's a Box Barcode (e.g. "BOX-NOR-M", "BOX-ZRE-M", "BOX-AMZ-M")
    const matchedBox = BOX_TYPES.find(b => b.barcode.toUpperCase() === rawCode || b.id.toUpperCase() === rawCode);
    if (matchedBox && activeOrder) {
      setOrders(prev => prev.map(o => {
        if (o.id === activeOrder.id) {
          return {
            ...o,
            boxRecommendation: matchedBox.id as BoxType,
            boxBranding: matchedBox.branding
          };
        }
        return o;
      }));
      if (!isMuted) playScanSuccess();
      setLastScan({
        id: Math.random().toString(),
        rawCode,
        resultType: 'box_selected',
        status: 'info',
        title: 'Scatola Assegnata',
        message: `Impostata ${matchedBox.name}`,
        timestamp: Date.now(),
      });
      return;
    }

    // 3. Check if it's a Marketing Flyer Barcode (e.g. "FLY-NOR-ITA", "FLY-ZRE-NUTRA", etc.)
    const matchedFlyer = MARKETING_FLYERS.find(f => f.code.toUpperCase() === rawCode);
    if (matchedFlyer && activeOrder) {
      // Verify this flyer is actually required for the current order
      const isRequiredForOrder = activeOrder.marketingFlyers.some(
        f => f.code.toUpperCase() === rawCode || f.id === matchedFlyer.id
      );

      if (!isRequiredForOrder) {
        if (!isMuted) playScanError();
        setLastScan({
          id: Math.random().toString(),
          rawCode,
          resultType: 'unknown_code',
          status: 'warning',
          title: 'Volantino Non Richiesto',
          message: `Il volantino "${matchedFlyer.title}" non è previsto per questo ordine.`,
          timestamp: Date.now(),
        });
        return;
      }

      setOrders(prev => prev.map(o => {
        if (o.id === activeOrder.id) {
          const updatedFlyers = o.marketingFlyers.map(f => {
            if (f.code.toUpperCase() === rawCode || f.id === matchedFlyer.id) {
              return { ...f, isIncluded: true };
            }
            return f;
          });
          return { ...o, marketingFlyers: updatedFlyers };
        }
        return o;
      }));
      if (!isMuted) playItemComplete();
      setLastScan({
        id: Math.random().toString(),
        rawCode,
        resultType: 'flyer_match',
        status: 'success',
        title: 'Volantino Inserito âœ“',
        message: `Confermato inserimento ${matchedFlyer.title} nella scatola!`,
        timestamp: Date.now(),
      });
      return;
    }

    // 4. Check if it's a Command Barcode (e.g. "CMD:PRINT-DHL", "CMD:COMPLETE")
    if (rawCode.startsWith('CMD:')) {
      if (rawCode === 'CMD:PRINT-DHL' || rawCode === 'CMD:COMPLETE') {
        const totalReq = activeOrder.items.reduce((s, i) => s + i.quantityRequired, 0);
        const totalScan = activeOrder.items.reduce((s, i) => s + i.quantityScanned, 0);
        const flyersOk = activeOrder.marketingFlyers.every(f => f.isIncluded);

        if (totalScan >= totalReq && flyersOk) {
          setIsLabelModalOpen(true);
          if (!isMuted) playOrderComplete();
        } else {
          if (!isMuted) playScanError();
          setLastScan({
            id: Math.random().toString(),
            rawCode,
            resultType: 'command',
            status: 'warning',
            title: 'Impossibile Stampare',
            message: `Scansiona prima tutti gli articoli mancanti e inserisci il volantino pubblicitario`,
            timestamp: Date.now(),
          });
        }
        return;
      }
    }

    // 5. Check if it's a Product EAN / SKU (from live database, with static fallback)
    const matchedProduct = productsList.find(
      p => p.ean === rawCode || p.sku.toUpperCase() === rawCode
    ) || NORSAN_PRODUCTS.find(
      p => p.ean === rawCode || p.sku.toUpperCase() === rawCode
    );

    if (!matchedProduct) {
      if (!isMuted) playScanError();
      setLastScan({
        id: Math.random().toString(),
        rawCode: code,
        resultType: 'unknown_code',
        status: 'error',
        title: 'Codice Sconosciuto',
        message: `Nessun articolo, volantino o comando corrispondente nel catalogo WMS: [${code}]`,
        timestamp: Date.now(),
      });
      return;
    }

    // Is this product part of the active order? (match by ID or EAN for full compatibility)
    const itemIndex = activeOrder.items.findIndex(
      it => it.product.id === matchedProduct.id || it.product.ean === matchedProduct.ean
    );

    if (itemIndex === -1) {
      // WRONG PRODUCT SCANNED! Prevented error!
      if (!isMuted) playScanError();
      setKpis(prev => ({
        ...prev,
        errorsPrevented: prev.errorsPrevented + 1,
      }));
      setLastScan({
        id: Math.random().toString(),
        rawCode: code,
        resultType: 'wrong_product',
        status: 'error',
        title: 'ERRORE PRODOTTO NON INCLUSO',
        message: `Attenzione! ${matchedProduct.name} non appartiene a questo ordine. Riporre nello scaffale [${matchedProduct.shelfLocation}]`,
        timestamp: Date.now(),
        matchedProduct,
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
        resultType: 'overpack',
        status: 'warning',
        title: 'Quantità Massima Già Raggiunta',
        message: `Tutti i ${currentItem.quantityRequired} pezzi di ${matchedProduct.name} sono già stati scansionati!`,
        timestamp: Date.now(),
        matchedProduct,
      });
      return;
    }

    // SUCCESSFUL PRODUCT SCAN (+quantityToAdd)
    const availableToAdd = currentItem.quantityRequired - currentItem.quantityScanned;
    const actualAdd = Math.max(1, Math.min(quantityToAdd, availableToAdd));
    const newScannedQty = currentItem.quantityScanned + actualAdd;
    const isItemDone = newScannedQty >= currentItem.quantityRequired;

    // Update state
    setOrders(prev => prev.map(ord => {
      if (ord.id === activeOrder.id) {
        const updatedItems: OrderItem[] = ord.items.map((it, idx) => {
          if (idx === itemIndex) {
            return {
              ...it,
              quantityScanned: newScannedQty,
              status: isItemDone ? 'completed' : 'in_progress',
            };
          }
          return it;
        });
        return { ...ord, items: updatedItems };
      }
      return ord;
    }));

    // Check if entire order is now 100% complete (strict Poka-Yoke item-by-item check)
    const itemsDone = activeOrder.items.every((it, idx) => {
      const scanned = idx === itemIndex ? newScannedQty : it.quantityScanned;
      return scanned >= it.quantityRequired;
    });
    const flyersOk = activeOrder.marketingFlyers.every(f => f.isIncluded);
    const isOrderDone = itemsDone && flyersOk;

    if (isOrderDone) {
      if (!isMuted) playOrderComplete();
      setIsLabelModalOpen(true);
      setLastScan({
        id: Math.random().toString(),
        rawCode: code,
        resultType: 'product_match',
        status: 'success',
        title: 'ORDINE COMPLETATO AL 100%',
        message: `Tutti i prodotti e volantini verificati! Pronto per la stampa dell'etichetta ${activeOrder.courier}.`,
        timestamp: Date.now(),
        matchedProduct,
      });
    } else if (isItemDone) {
      if (!isMuted) playItemComplete();
      setLastScan({
        id: Math.random().toString(),
        rawCode: code,
        resultType: 'product_match',
        status: 'success',
        title: actualAdd > 1 ? `CARTONE MASTER (+${actualAdd} PZ) âœ“` : 'Posizione Completata',
        message: `${matchedProduct.name} completato (${newScannedQty}/${currentItem.quantityRequired} pz). Posizione: [${matchedProduct.shelfLocation}]`,
        timestamp: Date.now(),
        matchedProduct,
      });
    } else {
      if (!isMuted) playScanSuccess();
      setLastScan({
        id: Math.random().toString(),
        rawCode: code,
        resultType: 'product_match',
        status: 'success',
        title: actualAdd > 1 ? `CARTONE MASTER (+${actualAdd} PZ)` : `SCANSIONE CORRETTA (+1)`,
        message: `Registrato ${matchedProduct.name} (+${actualAdd} pz: ${newScannedQty}/${currentItem.quantityRequired}). Posizione: [${matchedProduct.shelfLocation}]`,
        timestamp: Date.now(),
        matchedProduct,
      });
    }
  }, [orders, activeOrder, operators, productsList, isMuted, playScanSuccess, playScanError, playItemComplete, playOrderComplete]);

  // Hook for global keyboard scanner interception
  const { triggerManualScan } = useBarcodeScanner({
    onScan: handleBarcodeScanned,
  });

  // Finish order and advance to next
  const handleCompleteAndNext = () => {
    setIsLabelModalOpen(false);

    // Mark current order as packed
    setOrders(prev => prev.map(o => {
      if (o.id === activeOrderId) {
        return { ...o, status: 'packed', packingCompletedAt: Date.now() };
      }
      return o;
    }));

    // Update KPI
    setKpis(prev => ({
      ...prev,
      totalPackedToday: prev.totalPackedToday + 1,
      unitsPerHour: Math.round((prev.unitsPerHour + 1.2) * 10) / 10,
    }));

    // Update Station packed count
    setStations(prev => prev.map(st => {
      if (st.id === currentOperator.stationId) {
        return { ...st, ordersPackedToday: st.ordersPackedToday + 1 };
      }
      return st;
    }));

    // Find next ready order
    const nextOrder = orders.find(o => o.id !== activeOrderId && o.status !== 'packed');
    if (nextOrder) {
      setActiveOrderId(nextOrder.id);
      setLastScan({
        id: Math.random().toString(),
        rawCode: nextOrder.barcode,
        resultType: 'order_switch',
        status: 'info',
        title: 'Nuovo Ordine Caricato',
        message: `Caricato automaticamente ${nextOrder.orderNumber} per ${nextOrder.customerName}`,
        timestamp: Date.now(),
      });
    }
  };

  const handleResetData = () => {
    setOrders(INITIAL_ORDERS);
    setActiveOrderId(INITIAL_ORDERS[0].id);
    setLastScan(null);
  };

  const handleChangeBoxType = (boxType: BoxType) => {
    const matchedBox = BOX_TYPES.find(b => b.id === boxType);
    setOrders(prev => prev.map(o => {
      if (o.id === activeOrderId) {
        return {
          ...o,
          boxRecommendation: boxType,
          boxBranding: matchedBox ? matchedBox.branding : o.boxBranding
        };
      }
      return o;
    }));
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
      status: 'pending',
    };

    setIssues(prev => [newIssue, ...prev]);

    setLastScan({
      id: Math.random().toString(),
      rawCode: 'ISSUE-REPORTED',
      resultType: 'command',
      status: 'warning',
      title: 'Segnalazione Inviata al Team Lead',
      message: `Anomalia "${type}" notificata alla dashboard di direzione.`,
      timestamp: Date.now(),
    });
  };

  const handleResolveIssue = (issueId: string) => {
    setIssues(prev => prev.map(i => {
      if (i.id === issueId) {
        return { ...i, status: 'resolved' };
      }
      return i;
    }));
    if (!isMuted) playScanSuccess();
  };

  const handleSwitchToStation = (_stationId: string) => {
    setActiveView('packing');
  };

  // Handle Toggle View with RBAC check
  const handleToggleView = useCallback(() => {
    if (activeView === 'supervisor') {
      setActiveView('packing');
    } else {
      if (currentOperator.role === 'team_lead' || currentOperator.role === 'supervisor') {
        setActiveView('supervisor');
      } else {
        setIsSupervisorPinModalOpen(true);
      }
    }
  }, [activeView, currentOperator]);

  const handleSupervisorPinSuccess = useCallback((leadOp?: Operator) => {
    if (leadOp) {
      setCurrentOperator(leadOp);
    }
    setActiveView('supervisor');
  }, []);

  const handleLockTerminal = useCallback(() => {
    setIsTerminalLocked(true);
    setActiveView('packing');
  }, []);

  const handleLoginFromLockScreen = useCallback((operator: Operator) => {
    setCurrentOperator(operator);
    setIsTerminalLocked(false);
    if (!isMuted) playScanSuccess();
    setLastScan({
      id: Math.random().toString(),
      rawCode: operator.operatorCode,
      resultType: 'operator_login',
      status: 'info',
      title: 'Login Riuscito',
      message: `Benvenuto ${operator.name} [${operator.operatorCode}] • Ruolo: ${operator.role === 'team_lead' ? 'Team Lead' : 'Packer'}`,
      timestamp: Date.now(),
    });
  }, [isMuted, playScanSuccess]);




  return {
    activeView, setActiveView,
    operators, currentOperator, setCurrentOperator,
    stations, setStations, stationConfigId, setStationConfigId,
    orders, setOrders, activeOrderId, setActiveOrderId,
    lastScan, isMuted, setIsMuted,
    productsList, slotsList,
    issues, kpis, setKpis,
    isRackGuideOpen, setIsRackGuideOpen,
    isSimulatorOpen, setIsSimulatorOpen,
    isLabelModalOpen, setIsLabelModalOpen,
    isIssueModalOpen, setIsIssueModalOpen,
    isOperatorAuthOpen, setIsOperatorAuthOpen,
    isTerminalLocked, setIsTerminalLocked,
    isSupervisorPinModalOpen, setIsSupervisorPinModalOpen,
    
    handleAssignSlot, handleAddSlot, handleDeleteSlot,
    handleAddOperator, handleUpdateOperator, handleDeleteOperator,
    handleSubmitIssue, handleResolveIssue,
    handleToggleFlyer, handleToggleGift, handleTogglePhysicalDocument,
    handleSimulateIncomingWebOrder, handleBarcodeScanned,
    handleCompleteAndNext, handleResetData, handleChangeBoxType,
    handleSwitchToStation, handleToggleView, handleSupervisorPinSuccess,
    handleLockTerminal, handleLoginFromLockScreen, triggerManualScan,
    leadOperators, isTeamLead, activeOrder: orders.find(o => o.id === activeOrderId)
  };
}
