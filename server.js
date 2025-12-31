const express = require("express");
const cors = require("cors");
const Replicate = require("replicate");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* =======================
   ENV
======================= */
const {
  REPLICATE_API_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  PORT = 3000,
} = process.env;

if (!REPLICATE_API_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "25mb" }));

/* =======================
   HEALTH
======================= */
app.get("/", (req, res) => {
  res.json({ status: "Cartoonizer API running" });
});

/* =======================
   CARTOONIZE
======================= */
app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "Image data missing",
      });
    }

    /* =======================
       1️⃣ SAVE ORIGINAL IMAGE
    ======================= */
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    const originalName = `input-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(originalName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      throw uploadError;
    }

    const publicInputUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${originalName}`;

    console.log("📤 Uploaded input image:", publicInputUrl);

    /* =======================
       2️⃣ SEND URL TO REPLICATE
    ======================= */
    const output = await replicate.run(
      "cjwbw/anything-v3-better-vae:09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
      {
        input: {
          image: publicInputUrl,
        },
      }
    );

    const cartoonUrl = Array.isArray(output) ? output[0] : output;

    if (!cartoonUrl) {
      throw new Error("Replicate returned empty output");
    }

    console.log("🎨 Replicate output:", cartoonUrl);

    /* =======================
       3️⃣ RETURN RESULT
    ======================= */
    res.json({
      success: true,
      url: cartoonUrl,
    });
  } catch (err) {
    console.error("❌ Cartoonize failed:", err);
    res.status(500).json({
      success: false,
      error: "Image processing failed",
    });
  }
});

/* =======================
   404
======================= */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
