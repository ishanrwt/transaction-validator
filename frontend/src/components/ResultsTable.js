import { useState, Fragment } from "react";
import { STATUS_CONFIG } from "../constants/statusConfig";

function getIssuesSummary(row) {
  if (row.status === "VALID") {
    return "—";
  }

  const flaggedFields = row.errors.map((e) => e.field);

  // A field can fail multiple rules, but the table summary should list it once.
  return [...new Set(flaggedFields)].join(", ") || "—";
}

export default function ResultsTable({ rowResults }) {
  // Only one flagged row is expanded at a time to keep the table readable.
  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (rowNumber) => {
    setExpandedRow((current) => (current === rowNumber ? null : rowNumber));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${config.badgeClass}`}>
              {config.icon} {config.label}
            </span>
            <span>{config.description}</span>
          </div>
        ))}
      </div>
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
              const statusConfig = STATUS_CONFIG[row.status];
              const canExpand = row.status !== "VALID" && row.errors.length > 0;
              const isExpanded = expandedRow === row.row_number;

              return (
                <Fragment key={row.row_number}>
                  <tr
                    onClick={() => canExpand && toggleRow(row.row_number)}
                    className={`border-t border-slate-100 ${
                      canExpand ? "cursor-pointer hover:bg-slate-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">{row.row_number}</td>
                    <td className="px-4 py-3">{row.order_id ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          statusConfig?.badgeClass || "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {statusConfig ? `${statusConfig.icon} ${statusConfig.label}` : row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {getIssuesSummary(row)}
                      {canExpand && (
                        <span className="ml-2 text-xs text-slate-400">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      )}
                    </td>
                  </tr>
                  {canExpand && isExpanded && (
                    <tr className="bg-slate-50">
                      <td colSpan={4} className="px-4 py-3">
                        <p className="mb-2 text-sm font-medium text-slate-800">
                          {statusConfig.icon} {statusConfig.label} — {statusConfig.description}
                        </p>
                        <ul className="space-y-1 text-sm text-slate-700">
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
