require("dotenv").config();

const express = require("express");
const cors = require("cors");

const validateRoutes = require("./routes/validate");
const configRoutes = require("./routes/config");

const app = express();
const PORT = process.env.PORT || 5000;

// Keep local development and the deployed frontend as the only allowed browser origins.
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);

app.use(express.json());

// Lightweight endpoint used by deployment platforms and manual checks.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Route modules own their specific request handling and validation flow.
app.use("/api/validate", validateRoutes);
app.use("/api/config", configRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
