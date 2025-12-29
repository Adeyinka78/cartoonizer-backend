import express from "express";
import cors from "cors";

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(
  cors({
    origin: "*", // frontend + localhost allowed
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "10mb" }));

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (req, res) => {
  res.json({ status: "Cartoonizer API running" });
});

/* =======================
   CARTOONIZE ENDPOINT
======================= */
app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData, style } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    // 🔹 TEMP MOCK RESPONSE (replace with real AI later)
    const fakeImageUrl =
      "https://via.placeholder.com/512?text=Cartoonized+Image";

    return res.json({
      success: true,
      url: fakeImageUrl,
    });
  } catch (err) {
    console.error("Cartoonize error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/* =======================
   404 HANDLER (FIXED)
======================= */
app.all("/*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
