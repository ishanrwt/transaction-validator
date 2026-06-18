const multer = require("multer");
const path = require("path");

// Files are kept in memory because the validation pipeline reads the CSV buffer directly.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    // Reject early so non-CSV files never reach the validation pipeline.
    if ([".xlsx", ".xls", ".xlsm"].includes(extension)) {
      cb(new Error("This looks like an Excel file. Please save it as CSV first (File → Save As → CSV) and upload again."));
    } else if (extension === ".csv") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are accepted"));
    }
  },
});

module.exports = upload.single("file");
