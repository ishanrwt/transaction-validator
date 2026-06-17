import { useState, Fragment } from "react";

const STATUS_STYLES = {
  VALID: "bg-green-100 text-green-800",
  WARNING: "bg-amber-100 text-amber-800",
  INVALID: "bg-red-100 text-red-800",
};

function getIssuesSummary(row) {
  if (row.status === "VALID") {
    return "—";
  }

  if (row.status === "WARNING") {
    return row.errors.map((e) => e.field).join(", ") || "—";
  }

  const errorFields = row.errors
    .filter((e) => e.severity === "ERROR")
    .map((e) => e.field);

  return [...new Set(errorFields)].join(", ") || "—";
}

export default function ResultsTable({ rowResults }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (rowNumber) => {
    setExpandedRow((current) => (current === rowNumber ? null : rowNumber));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-96 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Row #</th>
              <th className="px-4 py-3 font-semibold">Order ID</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rowResults.map((row) => {
              const isInvalid = row.status === "INVALID";
              const isExpanded = expandedRow === row.row_number;

              return (
                <Fragment key={row.row_number}>
                  <tr
                    onClick={() => isInvalid && toggleRow(row.row_number)}
                    className={`border-t border-slate-100 ${
                      isInvalid ? "cursor-pointer hover:bg-red-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">{row.row_number}</td>
                    <td className="px-4 py-3">{row.order_id ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_STYLES[row.status] || "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {getIssuesSummary(row)}
                      {isInvalid && (
                        <span className="ml-2 text-xs text-slate-400">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      )}
                    </td>
                  </tr>
                  {isInvalid && isExpanded && (
                    <tr className="bg-red-50">
                      <td colSpan={4} className="px-4 py-3">
                        <ul className="space-y-1 text-sm text-red-800">
                          {row.errors.map((error, index) => (
                            <li key={`${error.rule_id}-${index}`}>
                              <span className="font-medium">{error.field}:</span>{" "}
                              {error.message}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
