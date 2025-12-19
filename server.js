require("dotenv").config();
console.log("Supabase Key:", process.env.SUPABASE_KEY ? "Loaded" : "NOT LOADED!");
console.log("Replicate Token:", process.env.REPLICATE_API_TOKEN ? "Loaded" : "NOT LOADED!");

const express = require("express");
const fetch = require("node-fetch");
const FormData = require("form-data");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const app = express();
app.use(express.json({ limit: "50mb" }));

// Correct Supabase values
const SUPABASE_URL = "https://bnpgyouounxcocxdgktv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Replicate token
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.post("/cartoonize", async (req, res) => {
    try {
        const { imageData, style } = req.body;

        const filename = `input-${Date.now()}.png`;

        // Upload original image to Supabase
        const { error: uploadError } = await supabase.storage
            .from("images")
            .upload(filename, Buffer.from(imageData, "base64"), {
                contentType: "image/png"
            });

        if (uploadError) throw uploadError;

        const inputUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${filename}`;

        // Replicate model
        const modelUrl = "https://api.replicate.com/v1/predictions";

        const payload = {
            version: "b4b9bb25b0aefaa73cf6780d3801896fc12a0dae64d177790f842c183b18cecb",
            input: { image: inputUrl, style }
        };

        let r = await fetch(modelUrl, {
            method: "POST",
            headers: {
                Authorization: `Token ${REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        let job = await r.json();

        // Poll until completed
        let status = job;
        while (status.status !== "succeeded" && status.status !== "failed") {
            await new Promise((r) => setTimeout(r, 2500));

            let rr = await fetch(`${modelUrl}/${job.id}`, {
                headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` }
            });

            status = await rr.json();
        }

        if (status.status === "failed") throw new Error("Replicate model failed");

        const resultImageUrl = status.output[0];
        const resultResp = await fetch(resultImageUrl);
        const arrayBuffer = await resultResp.arrayBuffer();

        // Add watermark
        const watermarked = await sharp(Buffer.from(arrayBuffer))
            .composite([
                {
                    input: Buffer.from(
                        '<svg><text x="10" y="20" font-size="24">MyCartoonApp</text></svg>'
                    ),
                    gravity: "southeast"
                }
            ])
            .toBuffer();

        const outFilename = `out-${Date.now()}.png`;

        await supabase.storage
            .from("images")
            .upload(outFilename, watermarked, {
                contentType: "image/png"
            });

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${outFilename}`;

        res.json({ success: true, url: publicUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
