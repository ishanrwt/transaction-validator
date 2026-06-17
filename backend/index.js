require("dotenv").config();

const express = require("express");
const cors = require("cors");

const validateRoutes = require("./routes/validate");
const configRoutes = require("./routes/config");

const app = express();
const PORT = process.env.PORT || 5000;

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.use("/api/validate", validateRoutes);
app.use("/api/config", configRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
