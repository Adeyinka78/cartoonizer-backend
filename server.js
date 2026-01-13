import express from "express";
import cors from "cors";
import * as fal from "@fal-ai/client";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ⭐ Correct Fal.ai initialization
fal.settings({
  credentials: process.env.FAL_KEY,
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Cartoonizer backend running (Fal FLUX img2img)" });
});

// Cartoonize endpoint
app.post("/cartoonize", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    console.log("Received image, sending to Fal FLUX...");

    // ⭐ Correct FLUX img2img endpoint
    const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
      input: {
        image_url: image, // base64 data URL from frontend
        prompt:
          "cartoon style portrait, clean lines, vibrant colors, smooth shading, Pixar-like, professional digital illustration",
        strength: 0.85,
        guidance_scale: 7,
        num_inference_steps: 24,
      },
      logs: false,
      onResult: () => {},
    });

    console.log("Fal FLUX result:", result);

    const images = result?.images || result?.output?.images || [];
    const firstImage = images[0]?.url || images[0];

    if (!firstImage) {
      return res.status(500).json({
        error: "Failed to generate cartoon image",
        details: "No image returned from Fal FLUX endpoint",
      });
    }

    return res.json({
      cartoonImage: firstImage,
    });
  } catch (error) {
    console.error("Cartoonize error (Fal):", error);
    return res.status(500).json({
      error: "Failed to cartoonize image",
      details: error.message,
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cartoonizer backend running on port ${PORT}`);
});