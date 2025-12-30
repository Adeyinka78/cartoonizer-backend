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
    const { imageData, style } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    console.log("🖼️ Sending image to Replicate...");

    const output = await replicate.run(
      "cjwbw/anything-v3-better-vae:09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
      {
        input: {
          image: imageData,
        },
      }
    );

    if (!output || !output[0]) {
      throw new Error("No output from Replicate");
    }

    const cartoonUrl = output[0];

    const imageResponse = await fetch(cartoonUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    const fileName = `cartoon-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
      });

    if (uploadError) throw uploadError;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

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
   EXPRESS 5 SAFE 404
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
