// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Ensure API key exists
if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in environment variables.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "API is running" });
});

/**
 * POST /generate-resume
 * Combined:
 *  - Create from scratch
 *  - Rewrite existing
 *  - Tailor to job description
 */
app.post("/generate-resume", async (req, res) => {
  try {
    const {
      name,
      role,
      experience,
      skills,
      existingResume,
      jobDescription,
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name and role are required.",
      });
    }

    // Build a clear, structured prompt
    const promptParts = [];

    promptParts.push(
      `You are an expert career coach and resume writer. ` +
        `Generate a professional, ATS-friendly resume in clean plain text format. ` +
        `Use clear section headings like SUMMARY, EXPERIENCE, SKILLS, EDUCATION. ` +
        `Write in third person implied (no "I" or "me").`
    );

    promptParts.push(`\nCandidate name: ${name}`);
    promptParts.push(`Target role: ${role}`);

    if (Array.isArray(experience) && experience.length > 0) {
      promptParts.push(
        `\nRaw experience items (bullet ideas, not formatted):\n` +
          experience.map((e, i) => `${i + 1}. ${e}`).join("\n")
      );
    }

    if (Array.isArray(skills) && skills.length > 0) {
      promptParts.push(
        `\nKey skills:\n${skills.join(", ")}`
      );
    }

    if (existingResume && existingResume.trim().length > 0) {
      promptParts.push(
        `\nExisting resume (to improve, rewrite, and structure better):\n` +
          existingResume
      );
    }

    if (jobDescription && jobDescription.trim().length > 0) {
      promptParts.push(
        `\nJob description (tailor the resume to this, using relevant keywords and responsibilities):\n` +
          jobDescription
      );
    }

    promptParts.push(
      `\nInstructions:\n` +
        `- If the existing resume is provided, rewrite and improve it rather than ignoring it.\n` +
        `- If a job description is provided, tailor the resume to that role.\n` +
        `- Use strong action verbs and, where possible, add reasonable metrics or impact.\n` +
        `- Keep the output as plain text with clear headings and bullet points.\n` +
        `- Do NOT add any explanation around the resume, only output the resume itself.`
    );

    const finalPrompt = promptParts.join("\n");

    const completion = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: finalPrompt,
    });

    const resumeText =
      completion.output[0]?.content[0]?.text || completion.output[0]?.content[0]?.value;

    if (!resumeText) {
      throw new Error("No resume text returned from model.");
    }

    res.json({
      success: true,
      resume: resumeText,
    });
  } catch (error) {
    console.error("Error in /generate-resume:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate resume.",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
});

/**
 * POST /linkedin-optimize
 * Generates:
 *  - Headline
 *  - About section
 *  - Experience bullets
 *  - Skills suggestions
 */
app.post("/linkedin-optimize", async (req, res) => {
  try {
    const {
      currentProfile,
      role,
      industry,
      experience,
      skills,
    } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: role is required.",
      });
    }

    const promptParts = [];

    promptParts.push(
      `You are a LinkedIn profile optimization expert. ` +
        `Create an optimized LinkedIn profile for a professional.\n`
    );

    promptParts.push(`Target role: ${role}`);
    if (industry) {
      promptParts.push(`Industry: ${industry}`);
    }

    if (currentProfile && currentProfile.trim().length > 0) {
      promptParts.push(
        `\nCurrent LinkedIn profile content (to improve and rewrite):\n` +
          currentProfile
      );
    }

    if (Array.isArray(experience) && experience.length > 0) {
      promptParts.push(
        `\nExperience details to incorporate:\n` +
          experience.map((e, i) => `${i + 1}. ${e}`).join("\n")
      );
    }

    if (Array.isArray(skills) && skills.length > 0) {
      promptParts.push(
        `\nSkills to highlight:\n${skills.join(", ")}`
      );
    }

    promptParts.push(
      `\nInstructions:\n` +
        `- Return a JSON object with the following keys ONLY: headline, about, experience, skills.\n` +
        `- "headline": A short, keyword-rich LinkedIn headline (<= 220 characters).\n` +
        `- "about": A compelling About section, 3–6 short paragraphs, first person, clear and professional.\n` +
        `- "experience": A list of bullet points (as plain text) that can be used under the Experience section. ` +
        `Focus on impact, metrics, and the target role.\n` +
        `- "skills": A list of 10–20 suggested skills relevant to the role and industry.\n` +
        `- Optimize for recruiters and ATS keywords.\n` +
        `- Respond with STRICTLY valid JSON, no backticks, no extra text.`
    );

    const finalPrompt = promptParts.join("\n");

    const completion = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: finalPrompt,
      response_format: { type: "json_object" },
    });

    const rawJson =
      completion.output[0]?.content[0]?.text || completion.output[0]?.content[0]?.value;

    if (!rawJson) {
      throw new Error("No JSON returned from model.");
    }

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (parseError) {
      console.error("Failed to parse JSON from model:", rawJson);
      throw new Error("Model returned invalid JSON.");
    }

    res.json({
      success: true,
      profile: {
        headline: parsed.headline || "",
        about: parsed.about || "",
        experience: parsed.experience || "",
        skills: parsed.skills || [],
      },
    });
  } catch (error) {
    console.error("Error in /linkedin-optimize:", error);
    res.status(500).json({
      success: false,
      error: "Failed to optimize LinkedIn profile.",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});