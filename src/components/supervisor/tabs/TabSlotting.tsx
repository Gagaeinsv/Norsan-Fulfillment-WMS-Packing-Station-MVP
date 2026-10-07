import React from "react";
import { WarehouseSlotData, SlottingManager } from "../SlottingManager";
import { Product } from "../../../types/wms";

interface TabSlottingProps {
  slots: WarehouseSlotData[];
  products: Product[];
  stationConfigId?: string;
  onAssignSlot: (slotCode: string, productId: string | null) => Promise<void>;
  onAddSlot: (side: "S" | "D", tier: 1 | 2 | 3) => Promise<void>;
  onDeleteSlot: (slotCode: string) => Promise<void>;
  onUpdateProductImage?: (productId: string, imageUrl: string) => void;
  onResetSlotsToDefault?: () => void;
}

export const TabSlotting: React.FC<TabSlottingProps> = ({
  slots,
  products,
  stationConfigId,
  onAssignSlot,
  onAddSlot,
  onDeleteSlot,
  onUpdateProductImage,
  onResetSlotsToDefault,
}) => (
  <SlottingManager
    slots={slots}
    products={products}
    stationConfigId={stationConfigId}
    onAssignSlot={onAssignSlot}
    onAddSlot={onAddSlot}
    onDeleteSlot={onDeleteSlot}
    onUpdateProductImage={onUpdateProductImage}
    onResetSlotsToDefault={onResetSlotsToDefault}
  />
);
