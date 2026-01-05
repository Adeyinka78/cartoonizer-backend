import express from "express";
import cors from "cors";
import Replicate from "replicate";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();

const {
  REPLICATE_API_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  FRONTEND_URL,
} = process.env;

if (!REPLICATE_API_TOKEN || !SUPABASE_URL || !SUPABASE_KEY || !FRONTEND_URL) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_URL);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

app.use(express.json({ limit: "25mb" }));

app.get("/", (_, res) => {
  res.json({ status: "Avatar API running" });
});

app.post("/cartoonize", async (req, res) => {
  console.log("📩 /cartoonize request received");

  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, error: "Image required" });
    }

    console.log("🎨 Running catacolabs/cartoonify model...");

    const output = await replicate.run(
      "catacolabs/cartoonify",
      {
        input: {
          image: imageData
        }
      }
    );

    console.log("🧪 RAW MODEL OUTPUT:", output);

    const imageUrl = output?.output;

    if (!imageUrl) {
      console.error("❌ Model returned no image URL");
      return res.status(500).json({ success: false, error: "Model failed" });
    }

    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const fileName = `avatar-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      return res.status(500).json({ success: false, error: "Upload failed" });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    console.log("✅ Avatar ready:", publicUrl);

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error("❌ Avatar generation error:", err);
    res.status(500).json({ success: false, error: "Avatar failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});