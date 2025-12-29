const express = require("express");
const cors = require("cors");
const Replicate = require("replicate");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* =======================
   ENVIRONMENT VARIABLES
======================= */
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!REPLICATE_API_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =======================
   MIDDLEWARE
======================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "20mb" }));

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

    console.log("🖼️ Processing image...");

    /* =======================
       1. SEND TO REPLICATE
    ======================== */
    const output = await replicate.run(
      "tencentarc/cartoon:latest",
      {
        input: {
          image: imageData,
          style: style || "3d"
        }
      }
    );

    if (!output || !output[0]) {
      throw new Error("Replicate returned no output");
    }

    const cartoonUrl = output[0];

    /* =======================
       2. DOWNLOAD CARTOON IMAGE
    ======================== */
    const response = await fetch(cartoonUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    /* =======================
       3. UPLOAD TO SUPABASE
    ======================== */
    const fileName = `cartoon-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    /* =======================
       4. RETURN RESULT
    ======================== */
    res.json({
      success: true,
      url: publicUrl,
    });

  } catch (err) {
    console.error("❌ Cartoonize error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to process image",
    });
  }
});

/* =======================
   404 HANDLER (EXPRESS 5 SAFE)
======================= */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});