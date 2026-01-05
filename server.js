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

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_URL);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

app.use(express.json({ limit: "25mb" }));

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (_, res) => {
  res.json({ status: "Avatar API running" });
});

/* =======================
   CARTOONIZE ROUTE
======================= */
app.post("/cartoonize", async (req, res) => {
  console.log("📩 /cartoonize request received");

  try {
    const { imageData } = req.body;

    if (!imageData) {
      console.log("❌ No image data received");
      return res.status(400).json({ success: false, error: "Image required" });
    }

    console.log("🎨 Running catacolabs/cartoonify model...");

    const output = await replicate.run(
      "catacolabs/cartoonify:f109015d60170dfb20460f17da8cb863155823c85ece1115e1e9e4ec7ef51d3b",
      {
        input: {
          image: imageData,
          seed: 12345
        }
      }
    );

    const imageUrl = output.url;
    console.log("🖼 Model output:", imageUrl);

    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const fileName = `avatar-${Date.now()}.png`;

    console.log("⬆️ Uploading to Supabase:", fileName);

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

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});