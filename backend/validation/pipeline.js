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

const NUMERIC_FIELDS = ["unit_price", "amount_paid", "line_total", "quantity", "discount"];
const ZERO_WIDTH_CHARS = /[\u200B\uFEFF\u00A0]/g;
const CSV_INJECTION_PATTERN = /^[=+\-@]/;

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

function headersMatch(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }

  return actual.every((header, index) => header.trim() === expected[index]);
}

function runStructuralCheck(fileBuffer) {
  if (!fileBuffer || fileBuffer.length === 0) {
    return abort("File is empty");
  }

  if (!isValidUtf8(fileBuffer)) {
    return abort("File is not valid UTF-8");
  }

  const text = fileBuffer.toString("utf8");
  if (text.trim().length === 0) {
    return abort("File is empty");
  }

  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return abort("CSV has no content");
  }

  const headerFields = parseCsvRow(records[0]).map((field) => field.trim());
  if (!headersMatch(headerFields, EXPECTED_HEADERS)) {
    return abort(
      `CSV headers must exactly match: ${EXPECTED_HEADERS.join(", ")}`
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

  return { ok: true };
}

function parseCsvBuffer(fileBuffer) {
  return new Promise((resolve, reject) => {
    const rows = [];

    Readable.from(fileBuffer)
      .pipe(csv({ strict: true }))
      .on("data", (row) => rows.push(row))
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

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
  return JSON.stringify(EXPECTED_HEADERS.map((field) => row[field] ?? null));
}

function prepareCleanedRow(row, result) {
  const output = {};
  const failedFields = new Set();

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
  const chunks = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }

  return chunks;
}

async function runPipeline(fileBuffer, config) {
  const structural = runStructuralCheck(fileBuffer);
  if (structural.aborted) {
    return structural;
  }

  const rows = await parseCsvBuffer(fileBuffer);
  sanitizeRows(rows);

  const seenRows = new Map();
  const rowResults = [];
  let validCount = 0;
  let warningCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const errors = runRules(row, index, config);

    const signature = rowSignature(row);
    if (seenRows.has(signature)) {
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
