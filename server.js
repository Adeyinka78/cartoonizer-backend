import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Cartoonizer backend running" });
});

// Cartoonize endpoint
app.post("/cartoonize", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    console.log("Received image, sending to FLUX...");

    // Run FLUX image-to-image
    const output = await replicate.run(
      "black-forest-labs/flux-dev-image-to-image",
      {
        input: {
          image, // base64 input
          prompt: "cartoon style portrait, clean lines, vibrant colors",
          strength: 0.85,
          guidance: 3.5,
        },
      }
    );

    console.log("FLUX output:", output);

    if (!output || !output[0]) {
      return res.status(500).json({
        error: "Failed to generate cartoon image",
      });
    }

    // Replicate returns a URL — send it back to frontend
    return res.json({
      cartoonImage: output[0],
    });
  } catch (error) {
    console.error("Cartoonize error:", error);
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