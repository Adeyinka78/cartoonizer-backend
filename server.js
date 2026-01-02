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
app.use(express.json({ limit: "20mb" }));

/* =======================
   HEALTH
======================= */
app.get("/", (_, res) => {
  res.json({ status: "OK" });
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

    console.log("🖼️ Creating Replicate prediction...");

    // 1️⃣ CREATE PREDICTION
    const prediction = await replicate.predictions.create({
      version:
        "09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
      input: {
        image: imageData,
      },
    });

    // 2️⃣ WAIT FOR COMPLETION
    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed") {
      await new Promise((r) => setTimeout(r, 1500));
      result = await replicate.predictions.get(result.id);
    }

    if (result.status === "failed") {
      throw new Error("Replicate failed");
    }

    const imageUrl = result.output[0];

    console.log("⬆ Uploading to Supabase...");

    // 3️⃣ DOWNLOAD IMAGE
    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const fileName = `cartoon-${Date.now()}.png`;

    // 4️⃣ UPLOAD TO SUPABASE
    const { error } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
      });

    if (error) throw error;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    // 5️⃣ RETURN
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error("❌ Cartoonize error:", err.message);
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
  console.log(`🚀 Server running on ${PORT}`);
});
