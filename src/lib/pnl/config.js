// frontend/src/services/config.js

// Default loss-rate assumptions (fraction 0-1)
export const DEFAULT_LOSS_RATES = {
  rto: 0.0,
  return_rate: 1.0,
  lost: 1.0,
  unresolved: 0.0,
};

// ---------------------------------------------------------------------------
// Status-priority map — used to resolve a single final status when one
// Sub Order No appears on multiple rows with different statuses.
// Higher number wins.  Terminal outcomes (return arriving after a shipped
// snapshot) must always supersede earlier, stale snapshots.
// ---------------------------------------------------------------------------
export const STATUS_PRIORITY = {
  cancelled: 5,
  rto: 4,
  return: 4,
  exchange: 3,
  delivered: 2,
  shipped: 1,
  lost: 4,
};

// Statuses where the customer kept the item → full COGS always.
export const COGS_FULL_STATUSES = new Set(["delivered", "exchange"]);

// Statuses where COGS is always zero (order never shipped).
export const COGS_ZERO_STATUSES = new Set(["cancelled"]);

// Statuses whose COGS fraction is a user-configurable loss rate.
// Maps status → the key in the loss_rates dict.
export const CONFIGURABLE_LOSS_STATUSES = {
  rto: "rto",
  return: "return", // maps to "return_rate" in UI state mostly but conceptually "return"
  lost: "lost",
};
