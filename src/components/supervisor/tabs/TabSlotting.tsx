import React from "react";
import { WarehouseSlotData, SlottingManager } from "../SlottingManager";
import { Product } from "../../../types/wms";

interface TabSlottingProps {
  slots: WarehouseSlotData[];
  products: Product[];
  onAssignSlot: (slotCode: string, productId: string | null) => Promise<void>;
  onAddSlot: (side: "S" | "D", tier: 1 | 2 | 3) => Promise<void>;
  onDeleteSlot: (slotCode: string) => Promise<void>;
}

export const TabSlotting: React.FC<TabSlottingProps> = ({
  slots,
  products,
  onAssignSlot,
  onAddSlot,
  onDeleteSlot,
}) => (
  <SlottingManager
    slots={slots}
    products={products}
    onAssignSlot={onAssignSlot}
    onAddSlot={onAddSlot}
    onDeleteSlot={onDeleteSlot}
  />
);
