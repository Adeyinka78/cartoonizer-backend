import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* -------------------- HEALTH CHECK -------------------- */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "cartoonizer-backend",
  });
});

/* -------------------- REPLICATE SETUP -------------------- */
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/* -------------------- CARTOONIZE ENDPOINT -------------------- */
app.post("/cartoonize", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const output = await replicate.run(
      "cjwbw/anything-v3-better-vae:09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
      {
        input: {
          prompt: `anime style, high quality, ${prompt}`,
          negative_prompt: "low quality, blurry, distorted, watermark",
          width: 512,
          height: 512,
          num_inference_steps: 20,
          guidance_scale: 7.5,
        },
      }
    );

    res.json({
      image: output[0],
    });
  } catch (error) {
    console.error("Replicate error:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
