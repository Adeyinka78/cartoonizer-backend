require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   ✅ OPEN CORS (REQUIRED)
========================= */
app.use(cors());
app.options("*", cors());

app.use(express.json({ limit: "50mb" }));

/* =========================
   Health Check
========================= */
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "cartoonizer-backend" });
});

/* =========================
   CARTOONIZE ENDPOINT
========================= */
app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "No image data provided",
      });
    }

    // TEMP RESPONSE (validates end-to-end)
    return res.json({
      success: true,
      url: "https://placehold.co/512x512/png?text=Cartoon+Result",
    });
  } catch (err) {
    console.error("Cartoonize error:", err);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
