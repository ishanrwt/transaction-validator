const multer = require("multer");

// Files are kept in memory because the validation pipeline reads the CSV buffer directly.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    // Reject early so non-CSV files never reach the validation pipeline.
    if (file.originalname.toLowerCase().endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are accepted"));
    }
  },
});

module.exports = upload.single("file");
