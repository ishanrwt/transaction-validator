const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

const PAYMENT_STATUSES = ["SUCCESS", "FAILED", "PENDING"];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Shared guard for text fields that could be opened in spreadsheet software.
const validateNoInjection = (value) => {
  if (!value || typeof value !== "string") return true;
  return !["=", "+", "-", "@"].includes(value.trim()[0]);
};

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function parseDate(value, formats) {
  // Strict parsing rejects impossible dates such as 32-13-2024.
  const str = String(value).trim();
  for (const format of formats) {
    const parsed = dayjs(str, format, true);
    if (parsed.isValid()) {
      return parsed;
    }
  }
  return null;
}

function parseTime(value, formats) {
  // Strict parsing rejects impossible times such as 25:61.
  const str = String(value).trim();
  for (const format of formats) {
    const parsed = dayjs(str, format, true);
    if (parsed.isValid()) {
      return parsed;
    }
  }
  return null;
}

function isPositiveInteger(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

function isPositiveNumber(value) {
  const num = Number(value);
  return !Number.isNaN(num) && num > 0;
}

function severityFor(field, defaultSeverity, config) {
  // Selected optional fields can be downgraded through config without changing code.
  return config.severity_overrides?.[field] ?? defaultSeverity;
}

function buildRules(config) {
  // Rules are rebuilt from config so Settings changes affect the next validation request.
  const { countries, date_formats, time_formats, payment_modes, order_statuses, currencies, max_lengths } =
    config;

  return [
    {
      id: "order_id_required",
      field: "order_id",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "order_id is required and must be non-empty",
    },
    {
      id: "customer_name_required",
      field: "customer_name",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "customer_name is required",
    },
    {
      id: "customer_name_max_length",
      field: "customer_name",
      condition: (value) => !isBlank(value),
      validate: (value) => String(value).length <= max_lengths.customer_name,
      severity: "ERROR",
      message: `customer_name must not exceed ${max_lengths.customer_name} characters`,
    },
    {
      id: "customer_name_csv_injection",
      field: "customer_name",
      condition: (value) => !isBlank(value),
      validate: validateNoInjection,
      severity: "ERROR",
      message: "customer_name must not start with =, +, -, or @",
    },
    {
      id: "country_code_required",
      field: "country_code",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "country_code is required",
    },
    {
      id: "country_code_valid",
      field: "country_code",
      condition: (value) => !isBlank(value),
      validate: (value) => Object.prototype.hasOwnProperty.call(countries, String(value).trim()),
      severity: "ERROR",
      message: "country_code must be a supported country",
    },
    {
      id: "phone_number_required",
      field: "phone_number",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "phone_number is required",
    },
    {
      id: "phone_number_format",
      field: "phone_number",
      condition: (value) => !isBlank(value),
      validate: (value, row) => {
        // Phone rules are country-specific: digit count is mandatory, prefix list is optional.
        const digits = String(value).replace(/\D/g, "");
        const countryCode = String(row.country_code || "").trim();
        const country = countries[countryCode];

        if (!country) {
          return false;
        }

        if (digits.length !== country.digits) {
          return false;
        }

        if (country.prefixes.length > 0) {
          const prefixMatch = country.prefixes.some((prefix) => digits.startsWith(prefix));
          if (!prefixMatch) {
            return false;
          }
        }

        return true;
      },
      severity: (value, row) =>
        countries[String(row.country_code || "").trim()] ? "ERROR" : "WARNING",
      message: (value, row) => {
        const countryCode = String(row.country_code || "").trim();
        const country = countries[countryCode];

        if (!country) {
          return "phone_number cannot be validated because country_code is not supported";
        }

        const digits = String(value).replace(/\D/g, "");
        if (digits.length !== country.digits) {
          return `phone_number must have ${country.digits} digits for country ${countryCode}`;
        }

        if (country.prefixes.length > 0 && !country.prefixes.some((p) => digits.startsWith(p))) {
          return `phone_number must start with one of: ${country.prefixes.join(", ")}`;
        }

        return "phone_number is invalid for the given country_code";
      },
    },
    {
      id: "email_format",
      field: "email",
      condition: (value) => !isBlank(value),
      validate: (value) => EMAIL_PATTERN.test(String(value).trim()),
      severity: severityFor("email", "ERROR", config),
      message: "email must be a valid email address",
    },
    {
      id: "email_max_length",
      field: "email",
      condition: (value) => !isBlank(value),
      validate: (value) => String(value).length <= max_lengths.email,
      severity: severityFor("email", "ERROR", config),
      message: `email must not exceed ${max_lengths.email} characters`,
    },
    {
      id: "order_date_required",
      field: "order_date",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "order_date is required",
    },
    {
      id: "order_date_format",
      field: "order_date",
      condition: (value) => !isBlank(value),
      validate: (value) => parseDate(value, date_formats) !== null,
      severity: "ERROR",
      message: `order_date must match one of: ${date_formats.join(", ")}`,
    },
    {
      id: "order_time_format",
      field: "order_time",
      condition: (value) => !isBlank(value),
      validate: (value) => parseTime(value, time_formats) !== null,
      severity: severityFor("order_time", "ERROR", config),
      message: `order_time must match one of: ${time_formats.join(", ")}`,
    },
    {
      id: "shipping_address_max_length",
      field: "shipping_address",
      condition: (value) => !isBlank(value),
      validate: (value) => String(value).length <= max_lengths.shipping_address,
      severity: severityFor("shipping_address", "ERROR", config),
      message: `shipping_address must not exceed ${max_lengths.shipping_address} characters`,
    },
    {
      id: "order_status_required",
      field: "order_status",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "order_status is required",
    },
    {
      id: "order_status_valid",
      field: "order_status",
      condition: (value) => !isBlank(value),
      validate: (value) => order_statuses.includes(String(value).trim()),
      severity: "ERROR",
      message: `order_status must be one of: ${order_statuses.join(", ")}`,
    },
    {
      id: "currency_required",
      field: "currency",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "currency is required",
    },
    {
      id: "currency_valid",
      field: "currency",
      condition: (value) => !isBlank(value),
      validate: (value) => currencies.includes(String(value).trim()),
      severity: "ERROR",
      message: `currency must be one of: ${currencies.join(", ")}`,
    },
    {
      id: "product_id_required",
      field: "product_id",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "product_id is required",
    },
    {
      id: "product_name_required",
      field: "product_name",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "product_name is required",
    },
    {
      id: "product_name_max_length",
      field: "product_name",
      condition: (value) => !isBlank(value),
      validate: (value) => String(value).length <= max_lengths.product_name,
      severity: "ERROR",
      message: `product_name must not exceed ${max_lengths.product_name} characters`,
    },
    {
      id: "PRODUCT_NAME_CSV_INJECTION",
      field: "product_name",
      condition: (value) => !isBlank(value),
      validate: validateNoInjection,
      severity: "ERROR",
      message: "product_name contains a potentially unsafe formula character",
    },
    {
      id: "CATEGORY_REQUIRED",
      field: "category",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "category is required",
    },
    {
      id: "CATEGORY_MAX_LENGTH",
      field: "category",
      condition: (value) => !isBlank(value),
      validate: (value) => String(value).length <= 50,
      severity: "ERROR",
      message: "category must be 50 characters or fewer",
    },
    {
      id: "CATEGORY_CSV_INJECTION",
      field: "category",
      condition: (value) => !isBlank(value),
      validate: validateNoInjection,
      severity: "ERROR",
      message: "category contains a potentially unsafe formula character",
    },
    {
      id: "quantity_required",
      field: "quantity",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "quantity is required",
    },
    {
      id: "quantity_positive_integer",
      field: "quantity",
      condition: (value) => !isBlank(value),
      validate: (value) => isPositiveInteger(value),
      severity: "ERROR",
      message: "quantity must be a positive integer greater than 0",
    },
    {
      id: "unit_price_required",
      field: "unit_price",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "unit_price is required",
    },
    {
      id: "unit_price_positive",
      field: "unit_price",
      condition: (value) => !isBlank(value),
      validate: (value) => isPositiveNumber(value),
      severity: "ERROR",
      message: "unit_price must be a positive number greater than 0",
    },
    {
      id: "discount_range",
      field: "discount",
      condition: (value) => !isBlank(value),
      validate: (value) => {
        const num = Number(value);
        return !Number.isNaN(num) && num >= 0 && num <= 100;
      },
      severity: "ERROR",
      message: "discount must be between 0 and 100",
    },
    {
      id: "line_total_required",
      field: "line_total",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "line_total is required",
    },
    {
      id: "line_total_cross_check",
      field: "line_total",
      condition: (value) => value !== null && value !== "",
      validate: (value, row) => {
        // Keep this independent from quantity/discount rules so each violation is reported.
        const qty = parseFloat(row.quantity);
        const price = parseFloat(row.unit_price);
        const disc = parseFloat(row.discount) || 0;
        if (isNaN(qty) || isNaN(price) || isNaN(parseFloat(value))) return false;
        const expected = qty * price * (1 - disc / 100);
        return Math.abs(parseFloat(value) - expected) <= 0.01;
      },
      severity: "ERROR",
      message: "line_total does not match quantity × unit_price × (1 - discount/100)",
    },
    {
      id: "payment_mode_required",
      field: "payment_mode",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "payment_mode is required",
    },
    {
      id: "payment_mode_valid",
      field: "payment_mode",
      condition: (value) => !isBlank(value),
      validate: (value) => payment_modes.includes(String(value).trim()),
      severity: "ERROR",
      message: `payment_mode must be one of: ${payment_modes.join(", ")}`,
    },
    {
      id: "transaction_id_max_length",
      field: "transaction_id",
      condition: (value) => !isBlank(value),
      validate: (value) => String(value).length <= max_lengths.transaction_id,
      severity: "WARNING",
      message: `transaction_id must not exceed ${max_lengths.transaction_id} characters`,
    },
    {
      id: "TRANSACTION_ID_CSV_INJECTION",
      field: "transaction_id",
      condition: (value) => !isBlank(value),
      validate: validateNoInjection,
      severity: "WARNING",
      message: "transaction_id contains a potentially unsafe formula character",
    },
    {
      id: "amount_paid_required",
      field: "amount_paid",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "amount_paid is required",
    },
    {
      id: "amount_paid_positive",
      field: "amount_paid",
      condition: (value) => !isBlank(value),
      validate: (value) => isPositiveNumber(value),
      severity: "ERROR",
      message: "amount_paid must be a positive number",
    },
    {
      id: "AMOUNT_PAID_MISMATCH",
      field: "amount_paid",
      condition: (value, row) => {
        // Only compare when both values are numeric; format rules handle non-numeric input.
        const paid = parseFloat(value);
        const total = parseFloat(row.line_total);
        return !isNaN(paid) && !isNaN(total);
      },
      validate: (value, row) =>
        Math.abs(parseFloat(value) - parseFloat(row.line_total)) <= 0.01,
      severity: "ERROR",
      message: "amount_paid does not match line_total",
    },
    {
      id: "FAILED_PAYMENT_WITH_FULL_AMOUNT",
      field: "amount_paid",
      condition: (value, row) =>
        row.payment_status === "FAILED" && !isNaN(parseFloat(value)),
      validate: (value) => parseFloat(value) === 0,
      severity: "WARNING",
      message: "amount_paid is non-zero but payment_status is FAILED",
    },
    {
      id: "SUCCESS_PAYMENT_WITH_ZERO_AMOUNT",
      field: "amount_paid",
      condition: (value, row) =>
        row.payment_status === "SUCCESS" && !isNaN(parseFloat(value)),
      validate: (value) => parseFloat(value) > 0,
      severity: "ERROR",
      message: "amount_paid must be greater than zero when payment_status is SUCCESS",
    },
    {
      id: "payment_status_required",
      field: "payment_status",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "payment_status is required",
    },
    {
      id: "payment_status_valid",
      field: "payment_status",
      condition: (value) => !isBlank(value),
      validate: (value) => PAYMENT_STATUSES.includes(String(value).trim()),
      severity: "ERROR",
      message: `payment_status must be one of: ${PAYMENT_STATUSES.join(", ")}`,
    },
    {
      id: "STATUS_CANCELLED_WITH_SUCCESS",
      field: "payment_status",
      condition: (_value, row) => row.order_status === "CANCELLED",
      validate: (value) => value !== "SUCCESS",
      severity: "ERROR",
      message: "payment_status cannot be SUCCESS when order_status is CANCELLED",
    },
    {
      id: "STATUS_CONFIRMED_WITH_FAILED",
      field: "payment_status",
      condition: (_value, row) => row.order_status === "CONFIRMED",
      validate: (value) => value !== "FAILED",
      severity: "ERROR",
      message: "payment_status cannot be FAILED when order_status is CONFIRMED",
    },
    {
      id: "STATUS_PENDING_ORDER_WITH_SUCCESS",
      field: "payment_status",
      condition: (_value, row) => row.order_status === "PENDING",
      validate: (value) => value !== "SUCCESS",
      severity: "ERROR",
      message: "payment_status cannot be SUCCESS when order_status is PENDING",
    },
    {
      id: "payment_date_required",
      field: "payment_date",
      condition: () => true,
      validate: (value) => !isBlank(value),
      severity: "ERROR",
      message: "payment_date is required",
    },
    {
      id: "payment_date_format",
      field: "payment_date",
      condition: (value) => !isBlank(value),
      validate: (value) => parseDate(value, date_formats) !== null,
      severity: "ERROR",
      message: `payment_date must match one of: ${date_formats.join(", ")}`,
    },
    {
      id: "payment_date_after_order_date",
      field: "payment_date",
      condition: (value, row) => !isBlank(value) && !isBlank(row.order_date),
      validate: (value, row) => {
        const paymentDate = parseDate(value, date_formats);
        const orderDate = parseDate(row.order_date, date_formats);

        if (!paymentDate || !orderDate) {
          return false;
        }

        return (
          paymentDate.isAfter(orderDate, "day") || paymentDate.isSame(orderDate, "day")
        );
      },
      severity: "ERROR",
      message: "payment_date must be on or after order_date",
    },
  ];
}

const rules = buildRules(require("../config.json"));

module.exports = rules;
module.exports.buildRules = buildRules;
