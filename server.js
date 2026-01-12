import express from "express";
import cors from "cors";
import Replicate from "replicate"; // no longer used, but keep if you want; can be removed
import * as fal from "@fal-ai/client";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Configure Fal.ai client with API key from env
fal.config({
  credentials: process.env.FAL_KEY,
});

// (Optional) If you no longer use Replicate anywhere, you can delete this block
// const replicate = new Replicate({
//   auth: process.env.REPLICATE_API_TOKEN,
// });

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Cartoonizer backend running (Fal + FLUX img2img)" });
});

// Cartoonize endpoint using Fal + FLUX.1 dev image-to-image
app.post("/cartoonize", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    console.log("Received image, sending to Fal FLUX...");

    // Fal FLUX.1 dev image-to-image endpoint
    // Docs: fal-ai/flux/dev/image-to-image
    const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
      input: {
        // Fal accepts an image URL or a base64 data URL; your frontend is sending a data URL
        image_url: image,
        prompt:
          "high quality cartoon style portrait, clean vector-like lines, vibrant colors, smooth shading, friendly avatar",
        strength: 0.85,
        // You can tweak these if you want different stylization
        guidance_scale: 7,
        num_inference_steps: 24,
      },
      // We only need the final result, no streaming
      logs: false,
      onResult: () => {},
    });

    console.log("Fal FLUX result:", result);

    // Fal responses typically include one or more images with URLs
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
      details: error.message || "Unknown Fal API error",
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cartoonizer backend running on port ${PORT}`);
});