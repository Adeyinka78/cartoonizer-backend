import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// -----------------------------
// OPENAI CLIENT
// -----------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/", (req, res) => {
  res.json({ status: "Backend is running" });
});

// -----------------------------
// CARTOONIZE ENDPOINT
// -----------------------------
app.post("/cartoonize", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    const prompt = `
      Convert the person in this image into a cartoon-style illustration.
      Here is the image in base64 format:
      ${image}
    `;

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024"
    });

    const item = result?.data?.[0];

    if (!item) {
      return res.status(500).json({
        error: "Cartoonization failed",
        details: result
      });
    }

    // CASE 1: Hosted URL
    if (item.url) {
      return res.json({ cartoonImage: item.url });
    }

    // CASE 2: Base64 PNG returned
    if (item.b64_json) {
      return res.json({
        cartoonImageBase64: `data:image/png;base64,${item.b64_json}`
      });
    }

    // If neither exists
    return res.status(500).json({
      error: "Cartoonization failed",
      details: item
    });

  } catch (error) {
    console.error("Cartoonize error:", error);
    res.status(500).json({
      error: "Failed to cartoonize image",
      details: error?.message || error,
    });
  }
});

// -----------------------------
// RESUME GENERATOR
// -----------------------------
app.post("/resume", async (req, res) => {
  try {
    const { details } = req.body;

    if (!details) {
      return res.status(400).json({ error: "Resume details are required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert resume writer. Produce a clean, ATS‑optimized resume.",
        },
        { role: "user", content: details },
      ],
    });

    res.json({ resume: completion.choices[0].message.content });

  } catch (error) {
    console.error("Resume error:", error);
    res.status(500).json({
      error: "Failed to generate resume",
      details: error?.message || error,
    });
  }
});

// -----------------------------
// LINKEDIN OPTIMIZER
// -----------------------------
app.post("/linkedin", async (req, res) => {
  try {
    const { profile } = req.body;

    if (!profile) {
      return res
        .status(400)
        .json({ error: "LinkedIn profile text is required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are a LinkedIn optimization expert. Rewrite the profile to be compelling, keyword‑rich, and professional.",
        },
        { role: "user", content: profile },
      ],
    });

    res.json({ optimized: completion.choices[0].message.content });

  } catch (error) {
    console.error("LinkedIn error:", error);
    res.status(500).json({
      error: "Failed to optimize LinkedIn profile",
      details: error?.message || error,
    });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});