require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const PORT = process.env.PORT || 3000;

if (!REPLICATE_API_TOKEN) {
  console.error("❌ Missing REPLICATE_API_TOKEN");
  process.exit(1);
}

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cartoonizer-frontend.vercel.app",
    ],
    methods: ["GET", "POST"],
  })
);

app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "cartoonizer-backend" });
});

app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "No image data provided",
      });
    }

    const replicateResponse = await axios.post(
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

    res.json({
      success: true,
      predictionId: replicateResponse.data.id,
    });
  } catch (err) {
    console.error("Replicate error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: "Cartoonization failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
