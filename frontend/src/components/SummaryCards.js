export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Total Rows",
      value: summary.total_rows,
      className: "border-slate-200 bg-white text-slate-800",
    },
    {
      label: "Valid ✓",
      value: summary.valid,
      className: "border-green-200 bg-green-50 text-green-800",
    },
    {
      label: "Warnings ⚠",
      value: summary.warnings,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "Invalid ✗",
      value: summary.invalid,
      className: "border-red-200 bg-red-50 text-red-800",
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
