require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const PORT = process.env.PORT || 3000;

// 🔍 Env check (safe logs)
console.log("ENV CHECK:", {
  SUPABASE_URL: !!SUPABASE_URL,
  SUPABASE_KEY: !!SUPABASE_KEY,
  REPLICATE_API_TOKEN: !!REPLICATE_API_TOKEN,
  PORT,
});

if (!SUPABASE_URL || !SUPABASE_KEY || !REPLICATE_API_TOKEN) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

const app = express();

// ✅ CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cartoonizer-frontend.vercel.app",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "50mb" }));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "cartoonizer-backend" });
});

// 🎨 CARTOONIZE ENDPOINT (Replicate AI)
app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "No image data provided",
      });
    }

    // 1️⃣ Create prediction
    const createResponse = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version:
          "09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
        input: {
          image: `data:image/png;base64,${imageData}`,
        },
      },
      {
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const predictionId = createResponse.data.id;

    // 2️⃣ Poll until completed
    let prediction;
    while (true) {
      await new Promise((r) => setTimeout(r, 3000));

      const pollResponse = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
          },
        }
      );

      prediction = pollResponse.data;

      if (prediction.status === "succeeded") break;
      if (prediction.status === "failed") {
        throw new Error("Replicate prediction failed");
      }
    }

    // 3️⃣ Return final image
    return res.json({
      success: true,
      url: prediction.output[0],
    });
  } catch (err) {
    console.error("❌ Cartoonize error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Cartoonization failed",
    });
  }
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
