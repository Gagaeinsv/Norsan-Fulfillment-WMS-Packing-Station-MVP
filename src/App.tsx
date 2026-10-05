import { OperatorAuthModal } from "./components/auth/OperatorAuthModal";
import { TerminalLockScreen } from "./components/auth/TerminalLockScreen";
import { BarcodeSimulator } from "./components/dev/BarcodeSimulator";
import { Header } from "./components/layout/Header";
import { OrderQueue } from "./components/queue/OrderQueue";
import { ActivePackingView } from "./components/packing/ActivePackingView";
import { StationRackGuide } from "./components/rack/StationRackGuide";
import { SupervisorPinModal } from "./components/auth/SupervisorPinModal";
import { SupervisorDashboard } from "./components/supervisor/SupervisorDashboard";
import { IssueReportModal } from "./components/dev/IssueReportModal";
import { ShippingLabelModal } from "./components/shipping/ShippingLabelModal";
import { useWarehouseState } from "./hooks/useWarehouseState";

export function App() {
  const state = useWarehouseState();
  const {
    activeView,
    operators,
    currentOperator,
    setCurrentOperator,
    stations,
    stationConfigId,
    setStationConfigId,
    orders,
    activeOrderId,
    setActiveOrderId,
    lastScan,
    isMuted,
    setIsMuted,
    productsList,
    slotsList,
    issues,
    kpis,
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
    isSupervisorPinModalOpen,
    setIsSupervisorPinModalOpen,

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
    handleCompleteAndNext,
    handleResetData,
    handleChangeBoxType,
    handleSwitchToStation,
    handleToggleView,
    handleSupervisorPinSuccess,
    handleLockTerminal,
    handleLoginFromLockScreen,
    triggerManualScan,
    leadOperators,
    isTeamLead,
    activeOrder,
  } = state;

  // If terminal is locked, display Kiosk Login Screen
  if (isTerminalLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
        <TerminalLockScreen
          operators={operators}
          onLogin={handleLoginFromLockScreen}
        />
        <BarcodeSimulator
          orders={orders}
          activeOrder={activeOrder as any}
          operators={operators}
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          onScan={triggerManualScan}
          onSimulateIncomingWebOrder={handleSimulateIncomingWebOrder}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans select-none">
      {/* Top Clean Industrial Header with Integrated Live Scanner Status */}
      <Header
        currentOperator={currentOperator}
        kpis={kpis}
        lastScan={lastScan}
        isMuted={isMuted}
        activeView={activeView}
        onToggleView={handleToggleView}
        onToggleMute={() => setIsMuted(!isMuted)}
        onOpenRackGuide={() => setIsRackGuideOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenOperatorAuth={() => setIsOperatorAuthOpen(true)}
        onLockTerminal={handleLockTerminal}
        onResetData={handleResetData}
        stationConfigId={stationConfigId}
        onChangeStationConfig={setStationConfigId}
      />

      {/* Main Content Area */}
      {activeView === "packing" ? (
        <main className="flex-1 p-2 grid grid-cols-1 lg:grid-cols-12 gap-2 max-w-[1920px] mx-auto w-full overflow-hidden min-h-0">
          {/* Left Side: Order Queue (3 cols on desktop) */}
          <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
            <OrderQueue
              orders={orders}
              activeOrderId={activeOrderId}
              onSelectOrder={setActiveOrderId}
            />
          </div>

          {/* Right Side: Active Order Terminal with Full Vertical Height (9 cols on desktop) */}
          <div className="lg:col-span-9 flex flex-col h-full min-h-0 relative">
            <ActivePackingView
              order={activeOrder as any}
              onSimulateScan={triggerManualScan}
              onToggleFlyer={handleToggleFlyer}
              onOpenLabelModal={() => setIsLabelModalOpen(true)}
              onOpenIssueModal={() => setIsIssueModalOpen(true)}
              onChangeBoxType={handleChangeBoxType}
              stationConfigId={stationConfigId}
              onToggleGift={handleToggleGift}
              onTogglePhysicalDocument={handleTogglePhysicalDocument}
            />
          </div>
        </main>
      ) : (
        <main className="flex-1 p-4 max-w-[1920px] mx-auto w-full h-[calc(100vh-84px)]">
          <SupervisorDashboard
            stations={stations}
            operators={operators}
            orders={orders}
            issues={issues}
            products={productsList}
            slots={slotsList}
            onAssignSlot={handleAssignSlot}
            onAddSlot={handleAddSlot}
            onDeleteSlot={handleDeleteSlot}
            onResolveIssue={handleResolveIssue}
            onSimulateIncomingWebOrder={handleSimulateIncomingWebOrder}
            onSwitchToStation={handleSwitchToStation}
            onAddOperator={handleAddOperator}
            onUpdateOperator={handleUpdateOperator}
            onDeleteOperator={handleDeleteOperator}
            onSimulateScan={triggerManualScan}
          />
        </main>
      )}

      {/* Rack 3-tier Map Modal (S/D standardisation) */}
      {isRackGuideOpen && (
        <StationRackGuide
          activeOrder={activeOrder as any}
          stationConfigId={stationConfigId}
          isTeamLead={isTeamLead}
          onClose={() => setIsRackGuideOpen(false)}
          onSimulateScan={triggerManualScan}
        />
      )}

      {/* Barcode Gun Simulator Drawer */}
      <BarcodeSimulator
        orders={orders}
        activeOrder={activeOrder as any}
        operators={operators}
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onScan={triggerManualScan}
        onSimulateIncomingWebOrder={handleSimulateIncomingWebOrder}
      />

      {/* Operator Authentication & Badge Modal */}
      <OperatorAuthModal
        operators={operators}
        currentOperator={currentOperator}
        isOpen={isOperatorAuthOpen}
        onClose={() => setIsOperatorAuthOpen(false)}
        onSelectOperator={setCurrentOperator}
      />

      {/* DHL Shipping Label & Completion Modal */}
      {isLabelModalOpen && (
        <ShippingLabelModal
          order={activeOrder as any}
          isOpen={isLabelModalOpen}
          onClose={() => setIsLabelModalOpen(false)}
          onCompleteAndNext={handleCompleteAndNext}
        />
      )}

      {/* Issue Report Modal */}
      {isIssueModalOpen && (
        <IssueReportModal
          order={activeOrder as any}
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
          onSubmitIssue={handleSubmitIssue}
        />
      )}

      {/* Supervisor PIN Protection Modal */}
      <SupervisorPinModal
        isOpen={isSupervisorPinModalOpen}
        onClose={() => setIsSupervisorPinModalOpen(false)}
        onSuccess={handleSupervisorPinSuccess}
        leadOperators={leadOperators}
      />
    </div>
  );
}

export default App;
