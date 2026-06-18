const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const router = express.Router();
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

// These keys are required for the validation engine to build its dynamic rules.
const REQUIRED_KEYS = [
  "countries",
  "date_formats",
  "payment_modes",
  "order_statuses",
  "chunk_size",
];

function hasRequiredKeys(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  return REQUIRED_KEYS.every((key) =>
    Object.prototype.hasOwnProperty.call(body, key)
  );
}

// Settings page uses this to hydrate the current validation configuration.
router.get("/", async (_req, res) => {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return res.json(JSON.parse(raw));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Persist the full config object so future validation requests use the new settings.
router.put("/", async (req, res) => {
  try {
    if (!hasRequiredKeys(req.body)) {
      return res.status(400).json({
        error: `Request body must include: ${REQUIRED_KEYS.join(", ")}`,
      });
    }

    await fs.writeFile(CONFIG_PATH, `${JSON.stringify(req.body, null, 2)}\n`, "utf8");

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
