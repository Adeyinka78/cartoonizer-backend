import express from "express";
import cors from "cors";
import Replicate from "replicate";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();

/* =======================
   ENV VARIABLES
======================= */
const {
  REPLICATE_API_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  FRONTEND_URL,
} = process.env;

if (
  !REPLICATE_API_TOKEN ||
  !SUPABASE_URL ||
  !SUPABASE_KEY ||
  !FRONTEND_URL
) {
  console.error("❌ Missing environment variables");
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
    origin: [
      FRONTEND_URL,
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());
app.use(express.json({ limit: "25mb" }));

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (_, res) => {
  res.json({ status: "Avatar API running" });
});

/* =======================
   CARTOONIZE (FULL + UPDATED)
======================= */
app.post("/cartoonize", async (req, res) => {
  console.log("📩 /cartoonize request received");

  try {
    const { imageData } = req.body;

    if (!imageData) {
      console.warn("⚠️ Missing imageData in request body");
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    console.log("🖼 Received imageData length:", imageData.length);

    /* =======================
       STEP 1 — FACE ENHANCEMENT
       Using new GFPGAN model:
       xinntao/gfpgan:1.4
======================= */
    console.log("🔍 Step 1: Running GFPGAN (xinntao/gfpgan:1.4)...");

    let enhanced;
    try {
      enhanced = await replicate.run(
        "xinntao/gfpgan:1.4",
        {
          input: {
            img: imageData, // NEW schema
          },
        }
      );
    } catch (err) {
      console.error("❌ GFPGAN ERROR:", err?.response?.data || err);
      return res.status(500).json({
        success: false,
        error: "Face enhancement failed",
        details: err?.response?.data || err,
      });
    }

    if (!enhanced?.[0]) {
      console.error("❌ GFPGAN returned invalid output:", enhanced);
      return res.status(500).json({
        success: false,
        error: "Face enhancement returned no output",
      });
    }

    console.log("✅ GFPGAN enhancement complete:", enhanced[0]);

    /* =======================
       STEP 2 — CARTOONIZATION
======================= */
    console.log("🎨 Step 2: Running Cartoon model (tencentarc/cartoon:3.0)...");

    let cartoon;
    try {
      cartoon = await replicate.run(
        "tencentarc/cartoon:3.0",
        {
          input: { image: enhanced[0] },
        }
      );
    } catch (err) {
      console.error("❌ CARTOON MODEL ERROR:", err?.response?.data || err);
      return res.status(500).json({
        success: false,
        error: "Cartoonization failed",
        details: err?.response?.data || err,
      });
    }

    if (!cartoon?.[0]) {
      console.error("❌ Cartoon model returned invalid output:", cartoon);
      return res.status(500).json({
        success: false,
        error: "Cartoonization returned no output",
      });
    }

    console.log("✅ Cartoonization complete:", cartoon[0]);

    /* =======================
       STEP 3 — DOWNLOAD RESULT
======================= */
    console.log("⬇️ Downloading cartoon image...");

    let buffer;
    try {
      const imgRes = await fetch(cartoon[0]);
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } catch (err) {
      console.error("❌ IMAGE DOWNLOAD ERROR:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to download cartoon image",
      });
    }

    console.log("📦 Image downloaded. Size:", buffer.length);

    /* =======================
       STEP 4 — UPLOAD TO SUPABASE
======================= */
    console.log("☁️ Uploading to Supabase...");

    const fileName = `avatar-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ SUPABASE UPLOAD ERROR:", uploadError);
      return res.status(500).json({
        success: false,
        error: "Supabase upload failed",
        details: uploadError,
      });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    console.log("✅ Upload complete:", publicUrl);

    return res.json({
      success: true,
      url: publicUrl,
    });

  } catch (err) {
    console.error("🔥 UNEXPECTED SERVER ERROR:", err?.response?.data || err);
    return res.status(500).json({
      success: false,
      error: "Unexpected server error",
      details: err?.response?.data || err,
    });
  }
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);