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
   CREDIT CONFIG (STEP 1B.2)
======================= */
export const CREDIT_COST = {
  basic: 1,     // standard cartoon
  premium: 3,   // future premium avatar
};

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
    origin: [FRONTEND_URL, "http://localhost:5173"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
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
   CARTOONIZE (NO CREDIT ENFORCEMENT YET)
======================= */
app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    console.log("🔍 Step 1: Face enhancement");

    const enhanced = await replicate.run(
      "tencentarc/gfpgan:latest",
      {
        input: { image: imageData },
      }
    );

    if (!enhanced?.[0]) {
      throw new Error("Face enhancement failed");
    }

    console.log("🎨 Step 2: Cartoonization");

    const cartoon = await replicate.run(
      "tencentarc/cartoon:latest",
      {
        input: { image: enhanced[0] },
      }
    );

    if (!cartoon?.[0]) {
      throw new Error("Cartoonization failed");
    }

    console.log("☁️ Step 3: Uploading to Supabase");

    const imgRes = await fetch(cartoon[0]);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const fileName = `avatar-${Date.now()}.png`;

    const { error } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) throw error;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    res.json({ success: true, url: publicUrl });

  } catch (err) {
    console.error("❌ Avatar error:", err);
    res.status(500).json({
      success: false,
      error: "Image processing failed",
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
