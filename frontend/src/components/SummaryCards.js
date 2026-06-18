import { STATUS_CONFIG } from "../constants/statusConfig";

export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Total Rows",
      value: summary.total_rows,
      className: "border-slate-200 bg-white text-slate-800",
    },
    {
      label: `${STATUS_CONFIG.VALID.icon} ${STATUS_CONFIG.VALID.label}`,
      value: summary.valid,
      className: STATUS_CONFIG.VALID.badgeClass,
    },
    {
      label: `${STATUS_CONFIG.WARNING.icon} ${STATUS_CONFIG.WARNING.label}`,
      value: summary.warnings,
      className: STATUS_CONFIG.WARNING.badgeClass,
    },
    {
      label: `${STATUS_CONFIG.INVALID.icon} ${STATUS_CONFIG.INVALID.label}`,
      value: summary.invalid,
      className: STATUS_CONFIG.INVALID.badgeClass,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border px-4 py-5 shadow-sm ${card.className}`}
        >
          <p className="text-sm font-medium opacity-80">{card.label}</p>
          <p className="mt-1 text-3xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
