export const STATUS_CONFIG = {
  VALID: {
    label: "Ready",
    icon: "✅",
    badgeClass: "bg-green-100 text-green-800",
    description: "This row is clean and included in your download.",
  },
  WARNING: {
    label: "Needs Review",
    icon: "⚠️",
    badgeClass: "bg-amber-100 text-amber-800",
    description: "This row is included but has minor issues worth checking.",
  },
  INVALID: {
    label: "Fix Required",
    icon: "❌",
    badgeClass: "bg-red-100 text-red-800",
    description: "This row was excluded. Here's what needs to be corrected.",
  },
};
