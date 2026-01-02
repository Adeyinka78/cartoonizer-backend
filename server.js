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

/* =======================
   CLIENTS
======================= */
const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "25mb" }));

/* =======================
   HEALTH
======================= */
app.get("/", (_, res) => {
  res.json({ status: "Cartoonizer API running" });
});

/* =======================
   CARTOONIZE
======================= */
app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, error: "No image data" });
    }

    console.log("🖼️ Received image");

    /* --- Replicate (ASYNC SAFE) --- */
    const prediction = await replicate.predictions.create({
      version: "efc7c21e5c8f5d71b8c3a6a7cfc7c63c1c8edc7f4b7d8a1c4d1c4d7c8a2d1e",
      input: { image: imageData },
    });

    let result = prediction;

    while (
      result.status !== "succeeded" &&
      result.status !== "failed"
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      result = await replicate.predictions.get(result.id);
    }

    if (result.status === "failed") {
      throw new Error("Replicate processing failed");
    }

    const imageUrl = result.output[0];
    console.log("✅ Replicate done");

    /* --- Upload to Supabase --- */
    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const filename = `cartoon-${Date.now()}.png`;

    const { error } = await supabase.storage
      .from("cartoonizer")
      .upload(filename, buffer, {
        contentType: "image/png",
      });

    if (error) throw error;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${filename}`;

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error("❌ Cartoonize error:", err);
    res.status(500).json({
      success: false,
      error: "Image processing failed",
    });
  }
});

/* =======================
   START
======================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
