const express = require("express");
const cors = require("cors");
const Replicate = require("replicate");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* =======================
   ENV CHECK
======================= */
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const PORT = process.env.PORT || 3000;

if (!REPLICATE_API_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

/* =======================
   CLIENTS
======================= */
const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: "*" }));
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
        error: "Image data missing",
      });
    }

    console.log("🎨 Sending image to Replicate...");

    const output = await replicate.run(
      "cjwbw/anything-v3-better-vae:09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
      {
        input: {
          image: imageData, // FULL base64 string
        },
      }
    );

    const imageUrl =
      Array.isArray(output) ? output[0] : output;

    if (!imageUrl) {
      throw new Error("Replicate returned no image");
    }

    console.log("✅ Replicate image URL:", imageUrl);

    /* =======================
       DOWNLOAD IMAGE
    ======================= */
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    /* =======================
       UPLOAD TO SUPABASE
    ======================= */
    const fileName = `cartoon-${Date.now()}.png`;

    const { error } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    res.json({
      success: true,
      url: publicUrl,
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
   SAFE 404
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
