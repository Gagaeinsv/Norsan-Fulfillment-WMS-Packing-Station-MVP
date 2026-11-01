import { Order } from "../types/wms";

// Production mode: no mock/demo orders preloaded.
// Orders are imported via Selly ERP CSV / API or scanned from packing slips.
export const INITIAL_ORDERS: Order[] = [];
