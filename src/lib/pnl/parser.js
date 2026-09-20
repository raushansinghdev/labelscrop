// SheetJS is ~1MB and Papa is only needed for the optional orders CSV, so neither is imported
// at module scope — that would pull both into the island's initial chunk and slow first
// interaction on the mobile devices most sellers use. They load on first real use instead.
//
// Most parse helpers below are synchronous (they take an already-read workbook), so they can't
// await the import themselves. Every flow reaches them via `readExcelFile`, which resolves the
// module first; `ensureXlsx` is exported so any other entry point can do the same.
let XLSX = null;

export const ensureXlsx = async () => {
	if (!XLSX) XLSX = await import("xlsx");
	return XLSX;
};

const requireXlsx = () => {
	if (!XLSX) throw new Error("Spreadsheet support is still loading. Please try again in a moment.");
	return XLSX;
};

const toNum = (val) => {
  if (val === undefined || val === null || val === "") return 0.0;
  const parsed = Number(val);
  return isNaN(parsed) ? 0.0 : parsed;
};

/**
 * Utility to parse an Excel File object using SheetJS
 * @param {File} file
 * @returns {Promise<XLSX.WorkBook>}
 */
export const readExcelFile = async (file) => {
  const xlsx = await ensureXlsx();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = xlsx.read(data, { type: "array", cellDates: true });
        resolve(workbook);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parses the "Order Payments" sheet from the workbook.
 */
export const parseOrderPayments = (workbook) => {
  const sheetName = "Order Payments";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Invalid Meesho payment file: 'Order Payments' sheet not found.");
  }

  // header: 1 means row index 1 (the 2nd row) is the header.
  const rawData = requireXlsx().utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (rawData.length < 2) {
    throw new Error("Invalid Meesho payment file: Missing headers or data in 'Order Payments'.");
  }

  const headers = rawData[1]; // row index 1 in the sheet is headers
  // The first data row (index 2) is the formula/legend row, so skip it.
  const rows = rawData.slice(3); // Start from index 3 (the 4th row)

  const df = [];
  for (const row of rows) {
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = row[idx];
    });

    const subOrderNo = (rowObj["Sub Order No"] || "").toString().trim();
    if (!subOrderNo) continue; // Skip empty rows

    const statusStr = (rowObj["Live Order Status"] || "").toString().trim();
    const isSentinelStatus = ["nan", "none", "", "null"].includes(statusStr.toLowerCase());

    df.push({
      "Sub Order No": subOrderNo,
      "Supplier SKU": (rowObj["Supplier SKU"] || "").toString().trim(),
      "Live Order Status": isSentinelStatus ? null : statusStr,
      "Order Date": rowObj["Order Date"] ? new Date(rowObj["Order Date"]) : null,
      "Payment Date": rowObj["Payment Date"] ? new Date(rowObj["Payment Date"]) : null,
      "Final Settlement Amount": toNum(rowObj["Final Settlement Amount"]),
      "Return Shipping Charge": toNum(rowObj["Return Shipping Charge (Incl. GST)"]),
      "Total Sale Amount (Incl. Shipping & GST)": toNum(rowObj["Total Sale Amount (Incl. Shipping & GST)"]),
      "Quantity": toNum(rowObj["Quantity"]),
      "Product Name": rowObj["Product Name"] ? rowObj["Product Name"].toString().trim() : undefined,
    });
  }

  return df;
};

/**
 * Parses an auxiliary sheet (Ads Cost, Referral, Compensation)
 */
export const parseSmallSheet = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rawData = requireXlsx().utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (rawData.length < 2) return [];

  const headers = rawData[1];
  const rows = rawData.slice(3); // Skip legend row

  const df = [];
  for (const row of rows) {
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = row[idx];
    });

    // Check for "No data is available"
    const firstColVal = String(row[0] || "");
    if (firstColVal.includes("No data is available")) {
      continue;
    }
    df.push(rowObj);
  }

  return df;
};

/**
 * Extract all unique SKU codes from a parsed workbook.
 * @param {XLSX.WorkBook} workbook
 * @returns {Array<string>} Array of unique SKUs
 */
export const extractUniqueSkus = (workbook) => {
  const payments = parseOrderPayments(workbook);
  const skus = new Set();
  for (const p of payments) {
    if (p["Supplier SKU"]) {
      skus.add(p["Supplier SKU"]);
    }
  }
  return Array.from(skus);
};

/**
 * Parse the Meesho Orders_*.csv export.
 * @param {File} file
 * @returns {Promise<Array>}
 */
export const parseOrdersCsv = (file) => {
  return new Promise((resolve, reject) => {
    import("papaparse").then(({ default: Papa }) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        const df = [];

        // Deduplicate rows based on JSON stringification
        const seen = new Set();

        for (const rowObj of data) {
          const key = JSON.stringify(rowObj);
          if (seen.has(key)) continue;
          seen.add(key);

          df.push({
            "Sub Order No": (rowObj["Sub Order No"] || "").toString().trim(),
            "SKU": (rowObj["SKU"] || "").toString().trim(),
            "Order Date": rowObj["Order Date"] ? new Date(rowObj["Order Date"]) : null,
            "Quantity": toNum(rowObj["Quantity"]),
            "Supplier Discounted Price (Incl GST and Commision)": toNum(
              rowObj["Supplier Discounted Price (Incl GST and Commision)"]
            ),
            "Reason for Credit Entry": rowObj["Reason for Credit Entry"]
          });
        }
        resolve(df);
      },
      error: reject
    });
    }).catch(reject);
  });
};

/**
 * Parses SKU costs from an Excel workbook.
 * Expects a sheet (first sheet) with headers: SKU CODE, MAKING COST (₹), PACKAGING COST (₹)
 * Optional: TOTAL COST (₹)
 * @param {XLSX.WorkBook} workbook
 * @returns {Object} cost map {sku: {making_cost: X, packaging_cost: Y}}
 */
export const parseCostsExcel = (workbook) => {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return {};

  const rawData = requireXlsx().utils.sheet_to_json(sheet);
  const costs = {};
  
  for (const row of rawData) {
    // Keys could vary slightly by case or spaces, so let's normalize the keys
    const getVal = (possibleKeys) => {
      const key = Object.keys(row).find(k => possibleKeys.includes(k.trim().toLowerCase()));
      return key ? row[key] : undefined;
    };
    
    const sku = getVal(["sku code", "sku"]);
    if (!sku) continue;

    const makingCost = toNum(getVal(["making cost (₹)", "making cost"]));
    const packagingCost = toNum(getVal(["packaging cost (₹)", "packaging cost"]));

    costs[sku.toString().trim()] = {
      making_cost: makingCost,
      packaging_cost: packagingCost
    };
  }
  
  return costs;
};

/**
 * Generates an Excel workbook from the costs object
 * @param {Object} costs {sku: {making_cost: X, packaging_cost: Y}}
 * @returns {XLSX.WorkBook}
 */
export const generateCostsExcel = async (costs) => {
  const XLSX = await ensureXlsx();
  const data = Object.entries(costs).map(([sku, val]) => {
    const making = val ? val.making_cost : 0;
    const packaging = val ? val.packaging_cost : 0;
    return {
      "SKU CODE": sku,
      "MAKING COST (₹)": making,
      "PACKAGING COST (₹)": packaging,
      "TOTAL COST (₹)": making + packaging
    };
  });
  
  // If costs is empty, add a dummy row so the template has headers
  if (data.length === 0) {
    data.push({
      "SKU CODE": "EXAMPLE_SKU",
      "MAKING COST (₹)": 150,
      "PACKAGING COST (₹)": 20,
      "TOTAL COST (₹)": 170
    });
  }

  const sheet = XLSX.utils.json_to_sheet(data);
  sheet['!cols'] = [
    { wch: 30 }, // SKU CODE
    { wch: 18 }, // MAKING COST (₹)
    { wch: 20 }, // PACKAGING COST (₹)
    { wch: 18 }, // TOTAL COST (₹)
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "SKU Costs");
  return workbook;
};
