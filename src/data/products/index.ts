/**
 * src/data/products/index.ts — Product catalog barrel
 *
 * Single import point for the entire NORSAN + ZREEN product catalog.
 * Each tier is in its own file (max ~200 lines). Add new products by
 * editing only the relevant tier file.
 */

import { NORSAN_SHELF_PRODUCTS } from './norsanShelf';
import { ZREEN_TIER_A }          from './zreenTierA';
import { ZREEN_TIER_B }          from './zreenTierB';
import { ZREEN_TIER_C }          from './zreenTierC';
import { ZREEN_TIER_D }          from './zreenTierD';

/** Full product catalog — all brands, all tiers */
export const NORSAN_PRODUCTS = [
  ...NORSAN_SHELF_PRODUCTS,
  ...ZREEN_TIER_A,
  ...ZREEN_TIER_B,
  ...ZREEN_TIER_C,
  ...ZREEN_TIER_D,
];

// Re-export individual tier arrays for StationRackGuide tier-level access
export { NORSAN_SHELF_PRODUCTS, ZREEN_TIER_A, ZREEN_TIER_B, ZREEN_TIER_C, ZREEN_TIER_D };
