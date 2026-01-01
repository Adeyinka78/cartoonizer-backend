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
const {
  REPLICATE_API_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  PORT = 3000,
} = process.env;

if (!REPLICATE_API_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

/* =======================
   CLIENTS
======================= */
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
   CARTOONIZE
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

    console.log("🖼️ Uploading input image...");

    /* =======================
       1. SAVE INPUT IMAGE
    ======================= */
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const inputFileName = `input-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(inputFileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Supabase upload failed:", uploadError);
      throw uploadError;
    }

    const publicInputUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${inputFileName}`;
    console.log("📤 Public image URL:", publicInputUrl);

    /* =======================
       2. SEND TO REPLICATE
    ======================= */
    console.log("🎨 Sending to Replicate...");

    const output = await replicate.run(
      "cjwbw/anything-v3-better-vae:09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
      {
        input: {
          prompt: "anime style portrait, high quality",
          init_image: publicInputUrl,
          strength: 0.65,
        },
      }
    );

    const cartoonUrl = Array.isArray(output) ? output[0] : output;

    if (!cartoonUrl) {
      throw new Error("Replicate returned empty output");
    }

    console.log("🖼️ Cartoon generated:", cartoonUrl);

    /* =======================
       3. DOWNLOAD RESULT
    ======================= */
    const imageResponse = await fetch(cartoonUrl);
    const cartoonBuffer = Buffer.from(await imageResponse.arrayBuffer());

    /* =======================
       4. UPLOAD RESULT
    ======================= */
    const outputFileName = `cartoon-${Date.now()}.png`;

    const { error: uploadResultError } = await supabase.storage
      .from("cartoonizer")
      .upload(outputFileName, cartoonBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadResultError) {
      console.error("❌ Supabase output upload failed:", uploadResultError);
      throw uploadResultError;
    }

    const publicOutputUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${outputFileName}`;

    /* =======================
       5. RESPOND
    ======================= */
    res.json({
      success: true,
      url: publicOutputUrl,
    });
  } catch (err) {
    console.error("❌ FULL ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Image processing failed",
    });
  }
});

/* =======================
   404 (EXPRESS-SAFE)
======================= */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
