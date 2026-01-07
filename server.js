import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import Replicate from "replicate";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// -----------------------------
// OPENAI
// -----------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -----------------------------
// REPLICATE
// -----------------------------
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/", (req, res) => {
  res.json({ status: "Backend is running" });
});

// -----------------------------
// CARTOONIZE (Replicate)
// -----------------------------
app.post("/cartoonize", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    const output = await replicate.run("tencentarc/cartoon:3.0", {
      input: {
        image: image,
        scale: 2,
      },
    });

    res.json({ cartoonImage: output });
  } catch (error) {
    console.error("Cartoonize error:", error);
    res.status(500).json({
      error: "Failed to cartoonize image",
      details: error?.message || error,
    });
  }
});

// -----------------------------
// RESUME GENERATOR (OpenAI)
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
// LINKEDIN OPTIMIZER (OpenAI)
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