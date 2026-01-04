import express from "express";
import cors from "cors";
import Replicate from "replicate";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();

/* =======================
   ENV VARIABLES
======================= */
const {
  REPLICATE_API_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_PRICE_ID,
  FRONTEND_URL,
} = process.env;

if (
  !REPLICATE_API_TOKEN ||
  !SUPABASE_URL ||
  !SUPABASE_KEY ||
  !STRIPE_SECRET_KEY ||
  !STRIPE_PRICE_ID ||
  !FRONTEND_URL
) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =======================
   MIDDLEWARE
======================= */
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Handle CORS preflight explicitly
app.options("*", cors());

app.use(express.json({ limit: "25mb" }));

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (_, res) => {
  res.json({ status: "Premium Avatar API running" });
});

/* =======================
   STRIPE CHECKOUT
======================= */
app.post("/create-checkout-session", async (_, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      mode: "payment",
      success_url: `${FRONTEND_URL}/?paid=true`,
      cancel_url: `${FRONTEND_URL}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe error:", err);
    res.status(500).json({ error: "Payment failed" });
  }
});

/* =======================
   STYLE PROMPTS (future-proof)
======================= */
const STYLE_PROMPTS = {
  anime: "anime portrait, clean lines, smooth skin, vibrant colors",
  pixar: "3d pixar style character, soft lighting, glossy finish",
  illustration: "premium digital illustration portrait, ultra detail",
};

/* =======================
   AVATAR GENERATION
======================= */
app.post("/cartoonize", async (req, res) => {
  try {
    const { imageData, style = "illustration" } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    // Safe style fallback (future use if you switch to a prompt-based model)
    const prompt = STYLE_PROMPTS[style] || STYLE_PROMPTS["illustration"];
    console.log("🎭 Using style prompt:", prompt);

    console.log("🔍 Step 1: Face enhancement");

    const enhanced = await replicate.run("tencentarc/gfpgan:latest", {
      input: { image: imageData },
    });

    if (!enhanced?.[0]) {
      throw new Error("Face enhancement failed");
    }

    console.log("🎨 Step 2: Cartoonization");

    const cartoon = await replicate.run("tencentarc/cartoon:latest", {
      input: {
        image: enhanced[0],
        // Note: cartoon model currently ignores prompt, so we do not pass it
      },
    });

    if (!cartoon?.[0]) {
      throw new Error("Cartoonization failed");
    }

    console.log("☁️ Step 3: Uploading to Supabase");

    const imgRes = await fetch(cartoon[0]);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const fileName = `avatar-${Date.now()}.png`;

    const { error } = await supabase.storage
      .from("cartoonizer")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) throw error;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error("❌ Avatar error:", err);
    res.status(500).json({
      success: false,
      error: "Image processing failed",
    });
  }
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);