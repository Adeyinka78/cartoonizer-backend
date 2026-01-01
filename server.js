const express = require("express");
const cors = require("cors");
const Replicate = require("replicate");
const { createClient } = require("@supabase/supabase-js");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

/* =======================
   ENV VARIABLES
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

app.use(express.json({ limit: "25mb" }));

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
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    console.log("🖼️ Received image, uploading to Supabase...");

    /* =======================
       1. UPLOAD ORIGINAL IMAGE
    ======================== */
    const inputFile = `input-${Date.now()}.png`;
    const buffer = Buffer.from(
      imageData.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const { error: uploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(inputFile, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const publicInputUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${inputFile}`;

    console.log("🌐 Image URL:", publicInputUrl);

    /* =======================
       2. SEND TO REPLICATE (IMAGE → CARTOON)
    ======================== */
    console.log("🎨 Sending to Replicate...");

    const output = await replicate.run(
      "tencentarc/cartoon:latest",
      {
        input: {
          image: publicInputUrl,
        },
      }
    );

    const cartoonUrl = Array.isArray(output) ? output[0] : output;

    if (!cartoonUrl) {
      throw new Error("Replicate returned no output");
    }

    console.log("🖼️ Cartoon generated:", cartoonUrl);

    /* =======================
       3. DOWNLOAD CARTOON IMAGE
    ======================== */
    const cartoonRes = await fetch(cartoonUrl);
    const cartoonBuffer = Buffer.from(await cartoonRes.arrayBuffer());

    /* =======================
       4. UPLOAD CARTOON IMAGE
    ======================== */
    const outputFile = `cartoon-${Date.now()}.png`;

    const { error: finalUploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(outputFile, cartoonBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (finalUploadError) {
      throw finalUploadError;
    }

    const publicCartoonUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${outputFile}`;

    /* =======================
       5. RETURN RESULT
    ======================== */
    res.json({
      success: true,
      url: publicCartoonUrl,
    });
  } catch (err) {
    console.error("❌ Cartoonize error:", err);
    res.status(500).json({
      success: false,
      error: "Image processing failed",
    });
  }
});

/* =======================
   404 HANDLER
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
