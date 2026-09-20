// frontend/src/services/skuCosts.js

const SKU_COSTS_KEY = "meesho_sku_costs";

/**
 * Read the SKU cost JSON from localStorage and normalise every entry to v2 format.
 * Returns: {sku: {"making_cost": float, "packaging_cost": float}}
 */
export function loadCosts() {
  const rawData = localStorage.getItem(SKU_COSTS_KEY);
  if (!rawData) {
    return {};
  }

  try {
    const raw = JSON.parse(rawData);
    const costs = {};

    for (const [sku, val] of Object.entries(raw)) {
      if (val !== null && typeof val === "object") {
        costs[sku] = {
          making_cost: Number(val.making_cost || 0),
          packaging_cost: Number(val.packaging_cost || 0),
        };
      } else if (val !== null) {
        // v1 flat format: entire cost treated as making_cost
        costs[sku] = {
          making_cost: Number(val),
          packaging_cost: 0.0,
        };
      } else {
        // null cost — SKU exists in template but cost not filled in
        costs[sku] = null;
      }
    }
    return costs;
  } catch (err) {
    console.error("Error parsing SKU costs from localStorage", err);
    return {};
  }
}

/**
 * Write costs in v2 format to localStorage.
 */
export function saveCosts(costs) {
  const out = {};
  
  // Sort keys for predictable output
  const sortedSkus = Object.keys(costs).sort();
  
  for (const sku of sortedSkus) {
    const val = costs[sku];
    if (val === null) {
      out[sku] = null;
    } else {
      out[sku] = {
        making_cost: Number(val.making_cost || 0),
        packaging_cost: Number(val.packaging_cost || 0),
      };
    }
  }

  localStorage.setItem(SKU_COSTS_KEY, JSON.stringify(out));
}

/**
 * Update one SKU's cost and persist. Returns the full updated dict.
 */
export function updateSingleSku(sku, makingCost, packagingCost) {
  const costs = loadCosts();
  costs[sku] = {
    making_cost: Number(makingCost || 0),
    packaging_cost: Number(packagingCost || 0),
  };
  saveCosts(costs);
  return costs;
}

/**
 * Generate a cost-file template with all given SKUs set to null.
 */
export function generateTemplate(skus) {
  const template = {};
  Array.from(skus).sort().forEach(sku => {
    template[sku] = null;
  });
  return template;
}

/**
 * Return SKUs that have no cost entry (missing or null).
 */
export function getUnmappedSkus(allSkus, costs) {
  const unmapped = new Set();
  for (const sku of allSkus) {
    if (!(sku in costs) || costs[sku] === null) {
      unmapped.add(sku);
    }
  }
  return unmapped;
}
