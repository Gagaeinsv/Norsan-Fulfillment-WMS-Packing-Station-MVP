/**
 * src/data/norsanProducts.ts — backward-compatibility re-export shim
 *
 * All product data has been split into src/data/products/*.ts
 * All marketing data is in src/data/marketingFlyers.ts
 *
 * This file re-exports everything so existing imports keep working
 * without any changes to other files during refactoring.
 */

export {
  NORSAN_PRODUCTS,
  NORSAN_SHELF_PRODUCTS,
  ZREEN_TIER_A,
  ZREEN_TIER_B,
  ZREEN_TIER_C,
  ZREEN_TIER_D,
} from "./products/index";
export {
  MARKETING_FLYERS,
  BOX_TYPES,
  SERVICE_SKU_PREFIXES,
  isSellyErpServiceSku,
} from "./marketingFlyers";
