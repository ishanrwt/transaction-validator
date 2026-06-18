const { Readable } = require("stream");
const csv = require("csv-parser");
const { runRules } = require("./ruleEngine");

const EXPECTED_HEADERS = [
  "order_id",
  "customer_name",
  "phone_number",
  "country_code",
  "email",
  "order_date",
  "order_time",
  "order_status",
  "currency",
  "product_id",
  "product_name",
  "category",
  "shipping_address",
  "quantity",
  "unit_price",
  "discount",
  "line_total",
  "payment_mode",
  "transaction_id",
  "amount_paid",
  "payment_status",
  "payment_date",
];

const DEFAULT_OPTIONAL_COLUMNS = [
  "email",
  "order_time",
  "discount",
  "transaction_id",
  "category",
  "shipping_address",
];

const NUMERIC_FIELDS = ["unit_price", "amount_paid", "line_total", "quantity", "discount"];
const ZERO_WIDTH_CHARS = /[\u200B\uFEFF\u00A0]/g;
const CSV_INJECTION_PATTERN = /^[=+\-@]/;

// A structural abort stops the pipeline before row-level processing begins.
function abort(reason) {
  return { aborted: true, reason, stage: "structural" };
}

function isValidUtf8(buffer) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function stripBOM(str) {
  return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
}

function normalizeHeader(header) {
  return String(header).trim().toLowerCase();
}

function parseCsvRow(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}

// Split records manually first so we can validate header/column structure before csv-parser.
function parseCsvRecords(text) {
  const records = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
      }
      if (current.length > 0 || records.length > 0) {
        records.push(current);
      }
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    records.push(current);
  }

  return records.filter((record) => record.trim() !== "");
}

function getOptionalColumns(config) {
  const configuredOptionalColumns = Array.isArray(config?.optional_columns)
    ? config.optional_columns
    : DEFAULT_OPTIONAL_COLUMNS;

  return new Set(configuredOptionalColumns.map(normalizeHeader));
}

function getMissingRequiredHeaders(headers, optionalColumns) {
  const uploadedHeaders = new Set(headers);
  const requiredHeaders = EXPECTED_HEADERS.filter(
    (header) => !optionalColumns.has(header)
  );

  return requiredHeaders.filter((header) => !uploadedHeaders.has(header));
}

function getMissingOptionalHeaders(headers, optionalColumns) {
  const uploadedHeaders = new Set(headers);

  return EXPECTED_HEADERS.filter(
    (header) => optionalColumns.has(header) && !uploadedHeaders.has(header)
  );
}

function runStructuralCheck(fileBuffer, config) {
  if (!fileBuffer || fileBuffer.length === 0) {
    return abort("File is empty");
  }

  if (!isValidUtf8(fileBuffer)) {
    return abort("File is not valid UTF-8");
  }

  const text = stripBOM(fileBuffer.toString("utf8"));
  if (text.trim().length === 0) {
    return abort("File is empty");
  }

  // Stage 1: reject malformed CSV shape before any sanitization or validation.
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return abort("CSV has no content");
  }

  const headerFields = parseCsvRow(records[0]).map(normalizeHeader);
  const optionalColumns = getOptionalColumns(config);
  const missingHeaders = getMissingRequiredHeaders(headerFields, optionalColumns);
  if (missingHeaders.length > 0) {
    return abort(
      `This file is missing required columns: ${missingHeaders.join(", ")}. Please check your file and try again.`
    );
  }

  const expectedColumnCount = headerFields.length;
  for (let i = 1; i < records.length; i++) {
    const fieldCount = parseCsvRow(records[i]).length;
    if (fieldCount !== expectedColumnCount) {
      return abort(
        `Row ${i + 1} has ${fieldCount} columns, expected ${expectedColumnCount}`
      );
    }
  }

  return {
    ok: true,
    text,
    missingOptionalHeaders: getMissingOptionalHeaders(headerFields, optionalColumns),
  };
}

function normalizeParsedRow(row) {
  const normalized = {};

  for (const header of EXPECTED_HEADERS) {
    normalized[header] = Object.prototype.hasOwnProperty.call(row, header)
      ? row[header]
      : "";
  }

  return normalized;
}

function parseCsvText(text) {
  return new Promise((resolve, reject) => {
    const rows = [];

    Readable.from([text])
      .pipe(csv({ strict: true, mapHeaders: ({ header }) => normalizeHeader(header) }))
      .on("data", (row) => rows.push(normalizeParsedRow(row)))
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

// Stage 2: normalize string values while preserving enough information for validation.
function sanitizeString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  let str = String(value);
  str = str.replace(ZERO_WIDTH_CHARS, "");
  str = str.replace(/[\n\r]/g, "");
  str = str.trim();

  if (str === "") {
    return null;
  }

  // Prefix formula-like values to protect spreadsheet users from CSV injection.
  if (CSV_INJECTION_PATTERN.test(str)) {
    str = `'${str}`;
  }

  return str;
}

function coerceNumeric(value) {
  if (value === null || value === undefined) {
    return value;
  }

  const original = String(value).trim();
  // Strip common currency symbols and separators, but leave invalid values for rules to catch.
  const stripped = original.replace(/[$€£₹,\s]/g, "");

  if (stripped === "") {
    return value;
  }

  const num = Number(stripped);
  if (Number.isNaN(num)) {
    return value;
  }

  return stripped;
}

function sanitizeRows(rows) {
  // Mutate row objects in place so every later stage works from sanitized values.
  for (const row of rows) {
    for (const key of EXPECTED_HEADERS) {
      let value = sanitizeString(row[key]);

      if (NUMERIC_FIELDS.includes(key)) {
        value = coerceNumeric(value);
      }

      row[key] = value;
    }
  }
}

function rowSignature(row) {
  // Compare all expected fields so exact duplicates can be excluded from cleaned output.
  return JSON.stringify(EXPECTED_HEADERS.map((field) => row[field] ?? null));
}

function prepareCleanedRow(row, result) {
  const output = {};
  const failedFields = new Set();

  // Warning rows are kept, but fields that failed warning/info rules are blanked out.
  if (result.status === "WARNING") {
    for (const error of result.errors) {
      if (error.field && error.field !== "duplicate_row") {
        failedFields.add(error.field);
      }
    }
  }

  for (const field of EXPECTED_HEADERS) {
    if (failedFields.has(field)) {
      output[field] = null;
    } else {
      output[field] = row[field] ?? null;
    }
  }

  return output;
}

function prepareErrorRow(row) {
  const output = {};

  for (const field of EXPECTED_HEADERS) {
    output[field] = row[field] ?? null;
  }

  return output;
}

function determineStatus(errors) {
  // ERROR blocks the row, WARNING/INFO keeps it downloadable but visible to the user.
  if (errors.some((error) => error.severity === "ERROR")) {
    return "INVALID";
  }

  if (errors.some((error) => error.severity === "WARNING" || error.severity === "INFO")) {
    return "WARNING";
  }

  return "VALID";
}

function escapeCsvField(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeCsvField).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvField(row[header])).join(","));
  }

  return lines.join("\n");
}

function chunkRows(rows, chunkSize) {
  // Cleaned files are split so large uploads still produce manageable downloads.
  const chunks = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }

  return chunks;
}

async function runPipeline(fileBuffer, config) {
  const structural = runStructuralCheck(fileBuffer, config);
  if (structural.aborted) {
    return structural;
  }

  const rows = await parseCsvText(structural.text);
  sanitizeRows(rows);
  const missingOptionalHeaders = new Set(structural.missingOptionalHeaders);

  // Map stores the first row number for each exact row signature.
  const seenRows = new Map();
  const rowResults = [];
  let validCount = 0;
  let warningCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const errors = runRules(row, index, config).filter(
      (error) => !missingOptionalHeaders.has(error.field)
    );

    const signature = rowSignature(row);
    if (seenRows.has(signature)) {
      // Duplicate rows are invalid so cleaned output never repeats the same data.
      duplicateCount++;
      errors.push({
        field: "duplicate_row",
        value: null,
        rule_id: "duplicate_row",
        severity: "ERROR",
        message: `Duplicate of row ${seenRows.get(signature)}`,
      });
    } else {
      seenRows.set(signature, index + 1);
    }

    const status = determineStatus(errors);
    if (status === "VALID") {
      validCount++;
    } else if (status === "WARNING") {
      warningCount++;
    } else {
      invalidCount++;
    }

    rowResults.push({
      row_number: index + 1,
      order_id: row.order_id ?? null,
      status,
      errors,
    });
  }

  const cleanedRows = [];
  const errorRows = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const result = rowResults[index];

    if (result.status === "INVALID") {
      errorRows.push({
        ...prepareErrorRow(row),
        // Deduplicate field names while preserving every detailed error message.
        error_fields: [...new Set(result.errors.map((error) => error.field))].join(","),
        error_messages: result.errors.map((error) => error.message).join("|"),
      });
    } else {
      cleanedRows.push(prepareCleanedRow(row, result));
    }
  }

  const cleanedRowChunks = chunkRows(cleanedRows, config.chunk_size);
  const cleaned_chunks = cleanedRowChunks.map((chunk) =>
    rowsToCsv(EXPECTED_HEADERS, chunk)
  );

  const errorHeaders = [...EXPECTED_HEADERS, "error_fields", "error_messages"];
  const errors_csv =
    errorRows.length > 0 ? rowsToCsv(errorHeaders, errorRows) : "";

  return {
    aborted: false,
    summary: {
      total_rows: rows.length,
      valid: validCount,
      warnings: warningCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
    },
    row_results: rowResults,
    cleaned_chunks,
    errors_csv,
  };
}

module.exports = { runPipeline, EXPECTED_HEADERS };
