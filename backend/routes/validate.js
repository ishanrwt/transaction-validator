const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const upload = require("../middleware/upload");
const { runPipeline } = require("../validation/pipeline");

const router = express.Router();
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

router.post("/", (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const config = await loadConfig();
    const result = await runPipeline(req.file.buffer, config);

    if (result.aborted) {
      return res.status(422).json({
        aborted: true,
        reason: result.reason,
        stage: result.stage,
      });
    }

    const cleaned_chunks = result.cleaned_chunks.map((csv, index) => ({
      filename: `cleaned_part${index + 1}.csv`,
      data: Buffer.from(csv, "utf8").toString("base64"),
    }));

    const errors_file = {
      filename: "errors.csv",
      data: Buffer.from(result.errors_csv, "utf8").toString("base64"),
    };

    return res.status(200).json({
      summary: result.summary,
      row_results: result.row_results,
      cleaned_chunks,
      errors_file,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
