/**
 * WMS Phase & Feature Rollout Configuration (Bolzano Hub)
 *
 * PHASE 1 (ACTIVE IN PRODUCTION):
 *   - Packing Station Terminal (Postazione di Imballaggio)
 *   - Badge / PIN Operator Login (OP-01, OP-02, TL-01)
 *   - Selly ERP Order Queue + A4 Packing Slip Printing with Code 128 Barcode
 *   - Instant / On-Finish DHL Thermal Label Printing + Multi-Collo (+COLLO)
 *   - Shelf Location Guide (5S Left/Right Rack Map) & Box Recommendation
 *
 * PHASE 2–4 (FROZEN IN UI • DOCUMENTED IN STRATEGIC ROADMAP):
 *   - Inbound Gate Reception & Pallet Barcode Registration
 *   - Two-Tier Warehouse Inventory (Closed Cartons on Pallets + Open Shelf Units)
 *   - FEFO Lot & Expiry Date Traceability + Batch Recall (Reg. CE 178/2002)
 *   - Automatic ERP Stock Deduction on Order Packing & Smart Cycle Counting
 */

export const WMS_PHASE_CONFIG = {
  /** Phase 1 active: focused strictly on the Packing Station workflow */
  PHASE_1_PACKING_STATION_ONLY: true,

  /** Phase 2 (Frozen): FEFO Lot numbers & expiry dates on cards, slips, and labels */
  ENABLE_FEFO_LOT_TRACKING: false,

  /** Phase 3 (Frozen): Pallet + Shelf warehouse inventory & auto stock deduction */
  ENABLE_WAREHOUSE_INVENTORY_ERP: false,

  /** Phase 4 (Frozen): Advanced Lean Takt-Time & Kaizen telemetry tabs */
  ENABLE_LEAN_ANALYTICS_TABS: false,
};
