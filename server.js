import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// 🔐 ENVIRONMENT VARIABLES (REQUIRED)
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET,
  REPLICATE_API_TOKEN,
  REPLICATE_MODEL_VERSION,
  PORT = 3000,
} = process.env;

// ❌ HARD FAIL IF MISCONFIGURED
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !SUPABASE_BUCKET ||
  !REPLICATE_API_TOKEN ||
  !REPLICATE_MODEL_VERSION
) {
  throw new Error("❌ Missing required environment variables");
}

// ✅ Supabase Admin Client (BYPASSES RLS)
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// 🔁 Replicate polling helper
async function runReplicate(imageUrl) {
  const createRes = await fetch(
    "https://api.replicate.com/v1/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION,
        input: { image: imageUrl },
      }),
    }
  );

  const prediction = await createRes.json();

  if (!prediction?.id) {
    throw new Error("Failed to create Replicate prediction");
  }

  let result = prediction;

  while (
    result.status !== "succeeded" &&
    result.status !== "failed"
  ) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
        },
      }
    );

    result = await pollRes.json();
  }

  if (result.status === "failed") {
    throw new Error("Replicate image generation failed");
  }

  return result.output[0];
}

// 🎨 CARTOONIZE ROUTE
app.post(
  "/cartoonize",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      console.log("📥 Image received");

      // 1️⃣ Upload to Supabase
      const fileName = `uploads/${Date.now()}-${req.file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        throw new Error("Supabase upload failed");
      }

      const { data: publicData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(fileName);

      const imageUrl = publicData.publicUrl;

      console.log("☁️ Uploaded:", imageUrl);

      // 2️⃣ Send to Replicate
      const cartoonUrl = await runReplicate(imageUrl);

      console.log("🎉 Cartoon ready:", cartoonUrl);

      // 3️⃣ Return to frontend
      res.json({ cartoonUrl });
    } catch (err) {
      console.error("❌ Cartoonize error:", err);
      res.status(500).json({
        error: "Image processing failed",
        details: err.message,
      });
    }
  }
);

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
