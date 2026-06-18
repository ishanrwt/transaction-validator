import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.REACT_APP_API_URL || "http://localhost:5000";

const ALL_DATE_FORMATS = ["DD-MM-YYYY", "YYYY-MM-DD", "MM/DD/YYYY"];
const ALL_TIME_FORMATS = ["HH:mm:ss", "HH:mm"];
const ALWAYS_REQUIRED_COLUMNS = [
  "order_id",
  "customer_name",
  "order_date",
  "product_id",
  "quantity",
  "unit_price",
  "payment_mode",
  "amount_paid",
  "payment_status",
  "payment_date",
];
const CONFIGURABLE_COLUMNS = [
  "phone_number",
  "email",
  "order_time",
  "discount",
  "transaction_id",
  "category",
  "shipping_address",
];
const DEFAULT_OPTIONAL_COLUMNS = [
  "email",
  "order_time",
  "discount",
  "transaction_id",
  "category",
  "shipping_address",
];

const EMPTY_COUNTRY_DRAFT = { code: "", digits: "", prefixes: "" };

function prefixesToString(prefixes) {
  return (prefixes || []).join(", ");
}

function parsePrefixes(value) {
  // Convert the comma-separated UI value into the array expected by backend config.
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatColumnLabel(column) {
  return column.replace(/_/g, " ");
}

function TagInput({ label, tags, onChange, placeholder }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    // Store enum-style values consistently because validators compare exact strings.
    const value = input.trim().toUpperCase();
    if (!value || tags.includes(value)) {
      setInput("");
      return;
    }
    onChange([...tags, value]);
    setInput("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((item) => item !== tag))}
                className="text-slate-500 hover:text-slate-800"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={placeholder}
          className="w-full border-0 p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">Press Enter to add a value</p>
    </div>
  );
}

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [baseConfig, setBaseConfig] = useState(null);
  // Editable slices of config are separated so the form can update each section independently.
  const [countries, setCountries] = useState({});
  const [dateFormats, setDateFormats] = useState([]);
  const [timeFormats, setTimeFormats] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [orderStatuses, setOrderStatuses] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [optionalColumns, setOptionalColumns] = useState(DEFAULT_OPTIONAL_COLUMNS);
  const [chunkSize, setChunkSize] = useState(1000);

  const [showAddCountry, setShowAddCountry] = useState(false);
  const [addCountryDraft, setAddCountryDraft] = useState(EMPTY_COUNTRY_DRAFT);
  const [editingCode, setEditingCode] = useState(null);
  const [editCountryDraft, setEditCountryDraft] = useState(EMPTY_COUNTRY_DRAFT);

  useEffect(() => {
    if (!toast) return undefined;

    // Toasts are intentionally short-lived so the form stays uncluttered after saving.
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Load the deployed backend config so settings edits start from current rules.
        const response = await axios.get(`${API_URL}/api/config`);
        const config = response.data;

        setBaseConfig(config);
        setCountries(config.countries || {});
        setDateFormats(config.date_formats || []);
        setTimeFormats(config.time_formats || []);
        setPaymentModes(config.payment_modes || []);
        setOrderStatuses(config.order_statuses || []);
        setCurrencies(config.currencies || []);
        setOptionalColumns(config.optional_columns || DEFAULT_OPTIONAL_COLUMNS);
        setChunkSize(config.chunk_size ?? 1000);
      } catch (error) {
        setLoadError(
          error.response?.data?.error || error.message || "Failed to load settings"
        );
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const countryRows = Object.entries(countries).map(([code, rule]) => ({
    code,
    digits: rule.digits,
    prefixes: rule.prefixes || [],
  }));

  const toggleDateFormat = (format) => {
    setDateFormats((current) => {
      if (current.includes(format)) {
        // At least one date format must stay enabled for strict date validation.
        if (current.length === 1) return current;
        return current.filter((item) => item !== format);
      }
      return [...current, format];
    });
  };

  const toggleTimeFormat = (format) => {
    setTimeFormats((current) => {
      if (current.includes(format)) {
        return current.filter((item) => item !== format);
      }
      return [...current, format];
    });
  };

  const toggleOptionalColumn = (column) => {
    setOptionalColumns((current) => {
      if (current.includes(column)) {
        return current.filter((item) => item !== column);
      }
      return [...current, column];
    });
  };

  const resetAddCountry = () => {
    setShowAddCountry(false);
    setAddCountryDraft(EMPTY_COUNTRY_DRAFT);
  };

  const handleAddCountry = () => {
    const code = addCountryDraft.code.trim().toUpperCase();
    const digits = Number(addCountryDraft.digits);

    if (!code || !Number.isInteger(digits) || digits <= 0) {
      setToast({ type: "error", message: "Enter a valid country code and digit count" });
      return;
    }

    if (countries[code]) {
      setToast({ type: "error", message: "Country code already exists" });
      return;
    }

    setCountries((current) => ({
      ...current,
      [code]: {
        digits,
        prefixes: parsePrefixes(addCountryDraft.prefixes),
      },
    }));
    resetAddCountry();
  };

  const startEditingCountry = (code, rule) => {
    setEditingCode(code);
    setEditCountryDraft({
      code,
      digits: String(rule.digits),
      prefixes: prefixesToString(rule.prefixes),
    });
  };

  const cancelEditingCountry = () => {
    setEditingCode(null);
    setEditCountryDraft(EMPTY_COUNTRY_DRAFT);
  };

  const saveEditingCountry = () => {
    const newCode = editCountryDraft.code.trim().toUpperCase();
    const digits = Number(editCountryDraft.digits);

    if (!newCode || !Number.isInteger(digits) || digits <= 0) {
      setToast({ type: "error", message: "Enter a valid country code and digit count" });
      return;
    }

    if (newCode !== editingCode && countries[newCode]) {
      setToast({ type: "error", message: "Country code already exists" });
      return;
    }

    setCountries((current) => {
      const next = { ...current };
      // Support renaming a country code by replacing the old key.
      if (newCode !== editingCode) {
        delete next[editingCode];
      }
      next[newCode] = {
        digits,
        prefixes: parsePrefixes(editCountryDraft.prefixes),
      };
      return next;
    });

    cancelEditingCountry();
  };

  const deleteCountry = (code) => {
    setCountries((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });

    if (editingCode === code) {
      cancelEditingCountry();
    }
  };

  const handleSave = async () => {
    if (!baseConfig) return;

    // Clamp chunk size before writing so the backend receives a deploy-safe value.
    const normalizedChunkSize = Math.min(
      10000,
      Math.max(100, Number(chunkSize) || 1000)
    );

    const payload = {
      ...baseConfig,
      // Preserve untouched config sections while replacing the form-managed sections.
      countries,
      date_formats: dateFormats,
      time_formats: timeFormats.length > 0 ? timeFormats : ALL_TIME_FORMATS,
      payment_modes: paymentModes,
      order_statuses: orderStatuses,
      currencies,
      optional_columns: optionalColumns,
      chunk_size: normalizedChunkSize,
    };

    setSaving(true);

    try {
      await axios.put(`${API_URL}/api/config`, payload);
      setBaseConfig(payload);
      setChunkSize(normalizedChunkSize);
      setToast({ type: "success", message: "Settings saved" });
    } catch (error) {
      setToast({
        type: "error",
        message: error.response?.data?.error || error.message || "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-800">
        <p className="font-semibold">Could not load settings</p>
        <p className="mt-1 text-sm">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {toast && (
        <div
          className={`fixed right-4 top-20 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-800">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure validation rules and processing options.
        </p>
      </div>

      <div className="space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              Country Phone Rules
            </h3>
            <button
              type="button"
              onClick={() => setShowAddCountry(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Country
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Country Code</th>
                  <th className="px-3 py-2 font-semibold">Digits</th>
                  <th className="px-3 py-2 font-semibold">Allowed Prefixes</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {countryRows.map((row) => {
                  const isEditing = editingCode === row.code;

                  return (
                    <tr key={row.code} className="border-b border-slate-100">
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCountryDraft.code}
                            onChange={(event) =>
                              setEditCountryDraft((draft) => ({
                                ...draft,
                                code: event.target.value.toUpperCase(),
                              }))
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          row.code
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editCountryDraft.digits}
                            onChange={(event) =>
                              setEditCountryDraft((draft) => ({
                                ...draft,
                                digits: event.target.value,
                              }))
                            }
                            className="w-20 rounded border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          row.digits
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCountryDraft.prefixes}
                            onChange={(event) =>
                              setEditCountryDraft((draft) => ({
                                ...draft,
                                prefixes: event.target.value,
                              }))
                            }
                            placeholder="6, 7, 8, 9"
                            className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          row.prefixes.length > 0 ? row.prefixes.join(", ") : "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEditingCountry}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingCountry}
                              className="text-sm font-medium text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditingCountry(row.code, countries[row.code])
                              }
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCountry(row.code)}
                              className="text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {showAddCountry && (
                  <tr className="bg-slate-50">
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={addCountryDraft.code}
                        onChange={(event) =>
                          setAddCountryDraft((draft) => ({
                            ...draft,
                            code: event.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="IN"
                        className="w-24 rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="1"
                        value={addCountryDraft.digits}
                        onChange={(event) =>
                          setAddCountryDraft((draft) => ({
                            ...draft,
                            digits: event.target.value,
                          }))
                        }
                        placeholder="10"
                        className="w-20 rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={addCountryDraft.prefixes}
                        onChange={(event) =>
                          setAddCountryDraft((draft) => ({
                            ...draft,
                            prefixes: event.target.value,
                          }))
                        }
                        placeholder="6, 7, 8, 9"
                        className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddCountry}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={resetAddCountry}
                          className="text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            Date &amp; Time Formats
          </h3>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Date formats</p>
              <div className="space-y-2">
                {ALL_DATE_FORMATS.map((format) => {
                  const checked = dateFormats.includes(format);
                  const isLastChecked = checked && dateFormats.length === 1;

                  return (
                    <label
                      key={format}
                      className={`flex items-center gap-2 text-sm ${
                        isLastChecked ? "text-slate-400" : "text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLastChecked}
                        onChange={() => toggleDateFormat(format)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {format}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Time formats</p>
              <div className="space-y-2">
                {ALL_TIME_FORMATS.map((format) => (
                  <label
                    key={format}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={timeFormats.includes(format)}
                      onChange={() => toggleTimeFormat(format)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {format}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">
            Column Requirements
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Choose which configurable columns may be missing from uploaded CSV files.
            Present columns are still validated normally.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">
                Always Required
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALWAYS_REQUIRED_COLUMNS.map((column) => (
                  <label
                    key={column}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
                  >
                    <span>{formatColumnLabel(column)}</span>
                    <span className="text-xs font-medium">Required</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">
                Configurable
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CONFIGURABLE_COLUMNS.map((column) => {
                  const isOptional = optionalColumns.includes(column);

                  return (
                    <label
                      key={column}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span>{formatColumnLabel(column)}</span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${
                            isOptional ? "text-amber-700" : "text-blue-700"
                          }`}
                        >
                          {isOptional ? "Optional" : "Required"}
                        </span>
                        <input
                          type="checkbox"
                          checked={!isOptional}
                          onChange={() => toggleOptionalColumn(column)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Allowed Enums</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <TagInput
              label="Payment Modes"
              tags={paymentModes}
              onChange={setPaymentModes}
              placeholder="e.g. UPI"
            />
            <TagInput
              label="Order Statuses"
              tags={orderStatuses}
              onChange={setOrderStatuses}
              placeholder="e.g. PENDING"
            />
            <TagInput
              label="Currencies"
              tags={currencies}
              onChange={setCurrencies}
              placeholder="e.g. INR"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            Processing Settings
          </h3>
          <div className="max-w-xs">
            <label
              htmlFor="chunk-size"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Rows per output file
            </label>
            <input
              id="chunk-size"
              type="number"
              min="100"
              max="10000"
              value={chunkSize}
              onChange={(event) => setChunkSize(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">Min 100, max 10,000</p>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl justify-end px-4 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
