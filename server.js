require("dotenv").config();

const express = require("express");
const axios = require("axios");

const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "Loaded" : "NOT LOADED");
console.log("REPLICATE_API_TOKEN:", process.env.REPLICATE_API_TOKEN ? "Loaded" : "NOT LOADED");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const PORT = process.env.PORT || 3000;

if (!SUPABASE_URL || !SUPABASE_KEY || !REPLICATE_API_TOKEN) {
  throw new Error("Missing required environment variables");
}

const app = express();
app.use(express.json({ limit: "50mb" }));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
