// frontend/src/services/skuCosts.js

const SKU_COSTS_KEY = "meesho_sku_costs";

// The last costs saved this session, used when the browser won't let us read or write storage,
// so the P&L still sees what the seller just typed. It's lost on reload, which is what the Excel
// backup is for.
let memoryCopy = null;

/**
 * Read the SKU cost JSON from localStorage and normalise every entry to v2 format.
 * Returns: {sku: {"making_cost": float, "packaging_cost": float}}
 */
export function loadCosts() {
  // getItem throws, rather than returning null, where storage is blocked (strict privacy settings,
  // some in-app browsers). Every other store in the app already guards this; without it the whole
  // P&L failed with "The operation is insecure" instead of simply starting with no costs.
  let rawData = null;
  try {
    rawData = localStorage.getItem(SKU_COSTS_KEY);
  } catch {
    return memoryCopy ? JSON.parse(memoryCopy) : {};
  }
  if (!rawData) {
    return memoryCopy ? JSON.parse(memoryCopy) : {};
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

  memoryCopy = JSON.stringify(out);
  try {
    localStorage.setItem(SKU_COSTS_KEY, memoryCopy);
  } catch (err) {
    console.warn("Could not save SKU costs to this browser; keeping them for this visit only", err);
  }
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
