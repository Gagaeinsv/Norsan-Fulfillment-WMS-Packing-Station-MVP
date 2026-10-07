import { describe, it, expect } from "vitest";
import { NORSAN_PRODUCTS } from "../../src/data/norsanProducts";

// Every scannable code (EAN, SKU, alias) must resolve to exactly ONE product.
// A shared code makes the scanner pick the first match -> "wrong product" on the floor.
describe("Catalog barcode integrity", () => {
  it("has no barcode shared between different products", () => {
    const owners = new Map<string, Set<string>>();
    for (const p of NORSAN_PRODUCTS) {
      const codes = [p.ean, p.sku, ...(p.aliases || [])].filter(Boolean);
      for (const c of codes) {
        const key = String(c).trim().toUpperCase().replace(/^0+/, "");
        if (!owners.has(key)) owners.set(key, new Set());
        owners.get(key)!.add(p.id);
      }
    }
    const conflicts = [...owners.entries()]
      .filter(([, ids]) => ids.size > 1)
      .map(([code, ids]) => `${code} -> ${[...ids].join(", ")}`);
    expect(conflicts, conflicts.join("\n")).toEqual([]);
  });
});
