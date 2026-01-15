import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({ status: "Fal Cartoonizer Backend Running" });
});

app.post("/cartoonize", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    // Strip data URL prefix → Fal requires raw base64 only
    const base64 = image.replace(/^data:image\/\w+;base64,/, "");

    // ⭐ Correct Fal endpoint for your model
    const fluxRes = await fetch("https://api.fal.ai/fal-ai/flux-krea-lora", {
      method: "POST",
      headers: {
        "Authorization": `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          image_base64: base64,
          prompt: "cartoon style portrait, clean lines, vibrant colors, smooth shading",
          strength: 0.85,
          guidance_scale: 7,
          num_inference_steps: 24
        }
      })
    });

    const fluxJson = await fluxRes.json();

    const firstImage =
      fluxJson?.images?.[0]?.url ||
      fluxJson?.output?.images?.[0]?.url ||
      fluxJson?.images?.[0] ||
      null;

    if (!firstImage) {
      console.error("Fal FLUX returned no image:", fluxJson);
      return res.status(500).json({
        error: "No image returned from Fal",
        details: fluxJson
      });
    }

    return res.json({ cartoonImage: firstImage });

  } catch (error) {
    console.error("Cartoonize error:", error);
    return res.status(500).json({
      error: "Failed to cartoonize image",
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});