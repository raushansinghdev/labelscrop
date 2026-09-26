// frontend/src/services/calculator.js
import {
  STATUS_PRIORITY,
  COGS_FULL_STATUSES,
  COGS_ZERO_STATUSES
} from "./config";
import { parseOrderPayments, parseSmallSheet, toAmount } from "./parser";
import { getUnmappedSkus, loadCosts } from "./skuCosts";

/**
 * Pools rows from several files, counting a row that appears in more than one of them once.
 *
 * Sellers download a payment file per cycle, and the windows they pick overlap more often than
 * not — or the same file gets added twice, once as "file.xlsx" and once as "file 2.xlsx". Plain
 * concatenation counted every shared payment twice and inflated the profit with no warning.
 *
 * The rule is a multiset union: a key seen twice in one file is kept twice (Meesho does repeat
 * identical legs within a file), but a key seen in two files is kept as many times as the file
 * with the most copies of it holds. `onDuplicate` sees each row that was dropped.
 */
export const unionAcrossFiles = (perFile, keyOf, onDuplicate) => {
  const kept = new Map();
  const out = [];
  for (const rows of perFile) {
    const inThisFile = new Map();
    for (const row of rows) {
      const key = keyOf(row);
      const n = (inThisFile.get(key) || 0) + 1;
      inThisFile.set(key, n);
      if (n > (kept.get(key) || 0)) {
        kept.set(key, n);
        out.push(row);
      } else if (onDuplicate) {
        onDuplicate(row);
      }
    }
  }
  return out;
};

const time = (d) => (d instanceof Date ? d.getTime() : "");

/**
 * One payment leg's identity. Deliberately leaves out "Live Order Status": that column is the
 * order's status *on the day the file was downloaded*, so the same leg in a later download can
 * carry a newer status — and must still be recognised as the same money.
 */
const paymentKey = (r) =>
  [
    r["Sub Order No"],
    r["Supplier SKU"],
    time(r["Order Date"]),
    time(r["Payment Date"]),
    r["Final Settlement Amount"],
    r["Total Sale Amount (Incl. Shipping & GST)"],
    r["Return Shipping Charge"],
    r["Quantity"],
  ].join("|");

/**
 * Collapse the Order Payments array to one row per Sub Order No.
 */
export const resolveOrderLevel = (df) => {
  const grouped = new Map();

  df.forEach(row => {
    const subOrderNo = row["Sub Order No"];
    if (!grouped.has(subOrderNo)) {
      grouped.set(subOrderNo, {
        "Sub Order No": subOrderNo,
        supplier_sku: row["Supplier SKU"],
        product_name: row["Product Name"] || row["Supplier SKU"],
        order_date: row["Order Date"],
        payment_date: row["Payment Date"],
        quantity: row["Quantity"],
        gross_sale_amount: 0,
        net_settlement: 0,
        return_shipping_charge: 0,
        statuses: []
      });
    }

    const group = grouped.get(subOrderNo);

    // Update min order_date
    if (row["Order Date"] && (!group.order_date || row["Order Date"] < group.order_date)) {
      group.order_date = row["Order Date"];
    }

    // Update max payment_date
    if (row["Payment Date"] && (!group.payment_date || row["Payment Date"] > group.payment_date)) {
      group.payment_date = row["Payment Date"];
    }

    // Quantity takes MAX
    if (row["Quantity"] > group.quantity) {
      group.quantity = row["Quantity"];
    }

    // Summing settlements
    group.gross_sale_amount += row["Total Sale Amount (Incl. Shipping & GST)"] || 0;
    group.net_settlement += row["Final Settlement Amount"] || 0;
    group.return_shipping_charge += row["Return Shipping Charge"] || 0;

    if (row["Live Order Status"] !== null && row["Live Order Status"] !== undefined) {
      group.statuses.push(row["Live Order Status"]);
    }
  });

  const result = Array.from(grouped.values()).map(group => {
    // resolve status
    let finalStatus = null;
    let maxPriority = -1;

    group.statuses.forEach(s => {
      const priority = STATUS_PRIORITY[s.toLowerCase()] || 0;
      if (priority > maxPriority) {
        maxPriority = priority;
        finalStatus = s;
      }
    });

    group.status = finalStatus;
    group.status_norm = finalStatus ? finalStatus.toLowerCase() : "unknown";
    delete group.statuses;

    return group;
  });

  return result;
};

/**
 * Apply COGS
 */
export const applyCogs = (orderLevel, skuCosts, lossRates) => {
  return orderLevel.map(row => {
    const sku = row.supplier_sku;
    const costEntry = skuCosts[sku] || { making_cost: 0, packaging_cost: 0 };
    const makingCost = costEntry.making_cost || 0;
    const packagingCost = costEntry.packaging_cost || 0;

    row.making_cost = makingCost;
    row.packaging_cost = packagingCost;
    row.unit_cost = makingCost + packagingCost;
    row.cost_mapped = (sku in skuCosts) && (skuCosts[sku] !== null);

    let cogsMaking = 0;
    let cogsPackaging = 0;

    const status = row.status_norm;
    const qty = row.quantity;

    if (COGS_ZERO_STATUSES.has(status)) {
      cogsMaking = 0;
      cogsPackaging = 0;
    } else if (COGS_FULL_STATUSES.has(status)) {
      cogsMaking = makingCost * qty;
      cogsPackaging = packagingCost * qty;
    } else if (status === "rto") {
      cogsMaking = makingCost * qty * (lossRates.rto || 0.0);
      cogsPackaging = packagingCost * qty * (lossRates.rto_packaging_loss !== undefined ? lossRates.rto_packaging_loss : 1.0);
    } else if (status === "return") {
      cogsMaking = makingCost * qty * (lossRates.return !== undefined ? lossRates.return : 1.0);
      cogsPackaging = packagingCost * qty * (lossRates.return_packaging_loss !== undefined ? lossRates.return_packaging_loss : 1.0);
    } else if (status === "lost") {
      cogsMaking = makingCost * qty * (lossRates.lost !== undefined ? lossRates.lost : 1.0);
      cogsPackaging = packagingCost * qty * 1.0;
    } else {
      // Unresolved / shipped / unknown
      cogsMaking = makingCost * qty * (lossRates.unresolved !== undefined ? lossRates.unresolved : 0.0);
      cogsPackaging = packagingCost * qty * 1.0;
    }

    row.cogs_making = cogsMaking;
    row.cogs_packaging = cogsPackaging;
    row.cogs = cogsMaking + cogsPackaging;
    row.profit = row.net_settlement - row.cogs;

    return row;
  });
};

/**
 * Summarise account-level adjustments
 */
export const summarizeAccountLevel = (workbook) => {
  const books = Array.isArray(workbook) ? workbook : [workbook];
  const rowsOf = (sheet) =>
    unionAcrossFiles(books.map(book => parseSmallSheet(book, sheet)), (r) => JSON.stringify(r));
  const total = (rows, column) => rows.reduce((sum, r) => sum + toAmount(r[column]), 0);

  return {
    ads_cost: total(rowsOf("Ads Cost"), "Total Ads Cost"),
    referral_income: total(rowsOf("Referral Payments"), "Net Referral Amount"),
    compensation_recovery: total(rowsOf("Compensation and Recovery"), "Amount (inc GST) INR"),
  };
};

/**
 * Build SKU report
 */
export const buildSkuReport = (orderLevel) => {
  const skuMap = new Map();

  orderLevel.forEach(row => {
    const sku = row.supplier_sku;
    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku: sku,
        product_name: row.product_name,
        orders: 0,
        units: 0,
        delivered_orders: 0,
        rto_orders: 0,
        return_orders: 0,
        gross_sale_amount: 0,
        net_settlement: 0,
        cogs: 0,
        cogs_making: 0,
        cogs_packaging: 0,
        rto_cost: 0,
        profit: 0,
        cost_mapped: true
      });
    }

    const s = skuMap.get(sku);
    s.orders += 1;
    s.units += row.quantity;
    if (row.status_norm === "delivered") s.delivered_orders += 1;
    if (row.status_norm === "rto") {
      s.rto_orders += 1;
      s.rto_cost += row.cogs;
    }
    if (row.status_norm === "return") s.return_orders += 1;

    s.gross_sale_amount += row.gross_sale_amount;
    s.net_settlement += row.net_settlement;
    s.cogs += row.cogs;
    s.cogs_making += row.cogs_making;
    s.cogs_packaging += row.cogs_packaging;
    s.profit += row.profit;
    if (!row.cost_mapped) {
      s.cost_mapped = false;
    }
  });

  const result = Array.from(skuMap.values()).map(s => {
    if (s.net_settlement > 0) {
      s.margin_pct = (s.profit / s.net_settlement) * 100;
    } else {
      s.margin_pct = null;
    }
    s.avg_sale_price = s.units > 0 ? (s.gross_sale_amount / s.units) : 0;
    return s;
  });

  result.sort((a, b) => b.profit - a.profit);
  return result;
};

/**
 * Find pending orders
 */
export const findPendingOrders = (ordersDf, settledSubOrderNos) => {
  return ordersDf.filter(row => !settledSubOrderNos.has(row["Sub Order No"]));
};

/**
 * Build status breakdown
 */
export const buildStatusBreakdown = (orderLevel) => {
  const map = new Map();
  let total = orderLevel.length;

  orderLevel.forEach(r => {
    const s = r.status_norm;
    if (!map.has(s)) {
      map.set(s, { status: s, order_count: 0, total_settlement: 0 });
    }
    const grp = map.get(s);
    grp.order_count += 1;
    grp.total_settlement += r.net_settlement;
  });

  return Array.from(map.values()).map(grp => {
    grp.percentage = total > 0 ? (grp.order_count / total * 100) : 0;
    return grp;
  });
};

/**
 * Safe round function similar to backend
 */
const safeRound = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Math.round(val * 100) / 100;
};

/**
 * Orchestrator: Compute PnL directly in the browser
 */
/**
 * @param {XLSX.WorkBook|XLSX.WorkBook[]} workbook One payment file, or several to combine.
 *
 * Sellers download one payment file per cycle, so looking at a quarter means combining three.
 * Rows from every file are pooled before resolution, which also means a sub-order paid across
 * two files resolves to a single order with both legs counted — the same way multi-leg rows
 * inside one file already do.
 */
export const computePnl = async (workbook, ordersDf, lossRatesReq) => {
  const workbooks = Array.isArray(workbook) ? workbook : [workbook];
  if (workbooks.length === 0) {
    throw new Error("No payment file to calculate from.");
  }

  // 1. Parse order payments, counting any leg that appears in more than one file once. A dropped
  // duplicate can still carry a newer status than the copy that was kept, so its status survives
  // as a zero-amount row: status resolution already picks the most final status across legs.
  const statusOnly = [];
  const orderPaymentsRaw = unionAcrossFiles(
    workbooks.map(book => parseOrderPayments(book)),
    paymentKey,
    (dup) => {
      if (dup["Live Order Status"]) {
        statusOnly.push({
          ...dup,
          "Final Settlement Amount": 0,
          "Total Sale Amount (Incl. Shipping & GST)": 0,
          "Return Shipping Charge": 0,
        });
      }
    },
  ).concat(statusOnly);

  // Load SKU costs from localStorage
  const skuCosts = loadCosts();

  const lossRates = {
    rto: lossRatesReq.rto,
    return: lossRatesReq.return_rate,
    lost: lossRatesReq.lost,
    unresolved: lossRatesReq.unresolved,
    rto_packaging_loss: lossRatesReq.rto_packaging_loss,
    return_packaging_loss: lossRatesReq.return_packaging_loss,
  };

  // 2. Resolve to one row per sub order no
  let orderLevel = resolveOrderLevel(orderPaymentsRaw);

  // 3. Apply COGS
  orderLevel = applyCogs(orderLevel, skuCosts, lossRates);

  // 4. Account-level adjustments, totalled across every file — with the same overlap rule as the
  // orders, or two overlapping files would charge the shared days' ads spend twice.
  const extras = summarizeAccountLevel(workbooks);

  // 5. Build overall PnL
  const net_settlement = orderLevel.reduce((acc, row) => acc + row.net_settlement, 0);
  const return_shipping_charge = orderLevel.reduce((acc, row) => acc + (row.return_shipping_charge || 0), 0);
  const cogs = orderLevel.reduce((acc, row) => acc + row.cogs, 0);
  const cogs_making = orderLevel.reduce((acc, row) => acc + row.cogs_making, 0);
  const cogs_packaging = orderLevel.reduce((acc, row) => acc + row.cogs_packaging, 0);

  const cogs_making_lost = orderLevel.reduce((acc, row) => acc + (!COGS_FULL_STATUSES.has(row.status_norm) ? row.cogs_making : 0), 0);
  const cogs_packaging_lost = orderLevel.reduce((acc, row) => acc + (!COGS_FULL_STATUSES.has(row.status_norm) ? row.cogs_packaging : 0), 0);

  const making_loss_rto = orderLevel.reduce((acc, row) => acc + (row.status_norm === 'rto' ? row.cogs_making : 0), 0);
  const making_loss_return = orderLevel.reduce((acc, row) => acc + (row.status_norm === 'return' ? row.cogs_making : 0), 0);
  const packaging_loss_rto = orderLevel.reduce((acc, row) => acc + (row.status_norm === 'rto' ? row.cogs_packaging : 0), 0);
  const packaging_loss_return = orderLevel.reduce((acc, row) => acc + (row.status_norm === 'return' ? row.cogs_packaging : 0), 0);
  const gross_profit = net_settlement - cogs;
  const net_profit = gross_profit + extras.ads_cost + extras.referral_income + extras.compensation_recovery;

  // dates
  let payment_start = null;
  let payment_end = null;
  orderPaymentsRaw.forEach(r => {
    if (r["Payment Date"]) {
      if (!payment_start || r["Payment Date"] < payment_start) payment_start = r["Payment Date"];
      if (!payment_end || r["Payment Date"] > payment_end) payment_end = r["Payment Date"];
    }
  });

  const total_units = orderLevel.reduce((acc, row) => acc + row.quantity, 0);

  const formatDate = (dateObj) => {
    if (!dateObj) return "";
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const overall = {
    net_settlement: safeRound(net_settlement),
    cogs: safeRound(cogs),
    cogs_making: safeRound(cogs_making),
    cogs_packaging: safeRound(cogs_packaging),
    cogs_making_lost: safeRound(cogs_making_lost),
    cogs_packaging_lost: safeRound(cogs_packaging_lost),
    making_loss_rto: safeRound(making_loss_rto),
    making_loss_return: safeRound(making_loss_return),
    packaging_loss_rto: safeRound(packaging_loss_rto),
    packaging_loss_return: safeRound(packaging_loss_return),
    return_shipping_charge: safeRound(return_shipping_charge),
    gross_profit: safeRound(gross_profit),
    ads_cost: safeRound(extras.ads_cost),
    referral_income: safeRound(extras.referral_income),
    compensation_recovery: safeRound(extras.compensation_recovery),
    net_profit: safeRound(net_profit),
    payment_window_start: formatDate(payment_start),
    payment_window_end: formatDate(payment_end),
    total_orders: orderLevel.length,
    total_units: safeRound(total_units)
  };

  // 6. SKU-wise report
  const sku_df = buildSkuReport(orderLevel);
  const sku_rows = sku_df.map(row => ({
    ...row,
    units: safeRound(row.units),
    gross_sale_amount: safeRound(row.gross_sale_amount),
    net_settlement: safeRound(row.net_settlement),
    cogs: safeRound(row.cogs),
    cogs_making: safeRound(row.cogs_making),
    cogs_packaging: safeRound(row.cogs_packaging),
    rto_cost: safeRound(row.rto_cost),
    profit: safeRound(row.profit),
    margin_pct: row.margin_pct !== null ? safeRound(row.margin_pct) : null,
    avg_sale_price: safeRound(row.avg_sale_price)
  }));

  // 7. Status breakdown
  const status_breakdown = buildStatusBreakdown(orderLevel).map(item => ({
    ...item,
    total_settlement: safeRound(item.total_settlement),
    percentage: safeRound(item.percentage)
  }));

  // 8. Unmapped SKUs
  const allSkus = new Set(orderPaymentsRaw.map(r => r["Supplier SKU"]).filter(Boolean));
  const unmapped = getUnmappedSkus(allSkus, skuCosts);
  const unmapped_list = Array.from(unmapped).sort().map(sku => {
    const skuOrders = orderLevel.filter(r => r.supplier_sku === sku);
    const setAmt = skuOrders.reduce((acc, r) => acc + r.net_settlement, 0);
    return {
      sku,
      order_count: skuOrders.length,
      settlement_amount: safeRound(setAmt)
    };
  });

  // 9. Review orders
  const review_orders = orderLevel.filter(r => !r.status).map(r => ({
    sub_order_no: r["Sub Order No"],
    sku: r.supplier_sku,
    net_settlement: safeRound(r.net_settlement)
  }));

  // 10. Pending orders
  let pending = null;
  if (ordersDf && ordersDf.length > 0) {
    const settledIds = new Set(orderLevel.map(r => r["Sub Order No"]));
    const pendingDf = findPendingOrders(ordersDf, settledIds);

    if (pendingDf.length > 0) {
      const byStatusMap = new Map();
      pendingDf.forEach(r => {
        const status = r["Reason for Credit Entry"] || "Unknown";
        if (!byStatusMap.has(status)) {
          byStatusMap.set(status, { reason: status, orders: 0, gross_value: 0 });
        }
        const st = byStatusMap.get(status);
        st.orders += 1;
        st.gross_value += r["Supplier Discounted Price (Incl GST and Commision)"] || 0;
      });

      const totalPendingGross = pendingDf.reduce((acc, r) => acc + (r["Supplier Discounted Price (Incl GST and Commision)"] || 0), 0);

      pending = {
        total_pending: pendingDf.length,
        total_gross_value: safeRound(totalPendingGross),
        by_status: Array.from(byStatusMap.values()).map(s => ({
          ...s,
          gross_value: safeRound(s.gross_value)
        }))
      };
    } else {
      pending = { total_pending: 0, total_gross_value: 0, by_status: [] };
    }
  }

  return {
    overall,
    sku_rows,
    status_breakdown,
    unmapped_skus: unmapped_list,
    pending_orders: pending,
    review_orders,
    loss_rates: lossRatesReq
  };
};
