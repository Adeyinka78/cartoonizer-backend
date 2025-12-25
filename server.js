require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const PORT = process.env.PORT || 3000;

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
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://cartoonizer-frontend.vercel.app",
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "50mb" }));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "cartoonizer-backend" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
