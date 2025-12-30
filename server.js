const express = require("express");
const cors = require("cors");
const Replicate = require("replicate");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const app = express();

/* =======================
   ENVIRONMENT VARIABLES
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
    origin: true, // allow all origins safely
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.options("*", cors());
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
    const { imageData, style = "3d" } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    console.log("🖼️ Uploading original image to Supabase...");

    /* =======================
       1️⃣ SAVE ORIGINAL IMAGE
    ======================= */
    const originalFileName = `original-${Date.now()}.png`;
    const originalBuffer = Buffer.from(imageData, "base64");

    const { error: uploadOriginalError } = await supabase.storage
      .from("cartoonizer")
      .upload(originalFileName, originalBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadOriginalError) {
      console.error(uploadOriginalError);
      throw new Error("Failed to upload original image");
    }

    const originalPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${originalFileName}`;

    console.log("🎨 Sending image to Replicate...");

    /* =======================
       2️⃣ SEND TO REPLICATE
    ======================= */
    const output = await replicate.run(
      "tencentarc/cartoon:latest",
      {
        input: {
          image: originalPublicUrl,
          style,
        },
      }
    );

    if (!output || !output[0]) {
      throw new Error("Replicate returned no output");
    }

    const cartoonUrl = output[0];

    console.log("⬇️ Downloading cartoonized image...");

    /* =======================
       3️⃣ DOWNLOAD RESULT
    ======================= */
    const response = await fetch(cartoonUrl);
    const cartoonBuffer = Buffer.from(await response.arrayBuffer());

    /* =======================
       4️⃣ UPLOAD CARTOON IMAGE
    ======================= */
    const cartoonFileName = `cartoon-${Date.now()}.png`;

    const { error: uploadCartoonError } = await supabase.storage
      .from("cartoonizer")
      .upload(cartoonFileName, cartoonBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadCartoonError) {
      console.error(uploadCartoonError);
      throw new Error("Failed to upload cartoon image");
    }

    const cartoonPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${cartoonFileName}`;

    /* =======================
       5️⃣ RETURN RESULT
    ======================= */
    res.json({
      success: true,
      url: cartoonPublicUrl,
    });

  } catch (err) {
    console.error("❌ Cartoonize error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to process image",
    });
  }
});

/* =======================
   404 HANDLER (SAFE)
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
