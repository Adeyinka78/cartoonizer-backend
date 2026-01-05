/* =======================
   CARTOONIZE (FULL VERSION)
======================= */
app.post("/cartoonize", async (req, res) => {
  console.log("📩 /cartoonize request received");

  try {
    const { imageData } = req.body;

    /* =======================
       VALIDATION
    ======================= */
    if (!imageData) {
      console.warn("⚠️ Missing imageData in request body");
      return res.status(400).json({
        success: false,
        error: "Image data is required",
      });
    }

    console.log("🖼 Received imageData length:", imageData.length);

    /* =======================
       STEP 1 — FACE ENHANCEMENT
    ======================= */
    console.log("🔍 Step 1: Running GFPGAN (v1.4) for face enhancement...");

    let enhanced;
    try {
      enhanced = await replicate.run(
        "tencentarc/gfpgan:1.4",
        {
          input: { image: imageData },
        }
      );
    } catch (err) {
      console.error("❌ GFPGAN ERROR:", err?.response?.data || err);
      return res.status(500).json({
        success: false,
        error: "Face enhancement failed",
        details: err?.response?.data || err,
      });
    }

    if (!enhanced || !enhanced[0]) {
      console.error("❌ GFPGAN returned invalid output:", enhanced);
      return res.status(500).json({
        success: false,
        error: "Face enhancement returned no output",
      });
    }

    console.log("✅ GFPGAN enhancement complete. Output URL:", enhanced[0]);

    /* =======================
       STEP 2 — CARTOONIZATION
    ======================= */
    console.log("🎨 Step 2: Running Cartoon model (v3.0)...");

    let cartoon;
    try {
      cartoon = await replicate.run(
        "tencentarc/cartoon:3.0",
        {
          input: { image: enhanced[0] },
        }
      );
    } catch (err) {
      console.error("❌ CARTOON MODEL ERROR:", err?.response?.data || err);
      return res.status(500).json({
        success: false,
        error: "Cartoonization failed",
        details: err?.response?.data || err,
      });
    }

    if (!cartoon || !cartoon[0]) {
      console.error("❌ Cartoon model returned invalid output:", cartoon);
      return res.status(500).json({
        success: false,
        error: "Cartoonization returned no output",
      });
    }

    console.log("✅ Cartoonization complete. Output URL:", cartoon[0]);

    /* =======================
       STEP 3 — DOWNLOAD RESULT
    ======================= */
    console.log("⬇️ Downloading cartoon image from Replicate...");

    let buffer;
    try {
      const imgRes = await fetch(cartoon[0]);
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } catch (err) {
      console.error("❌ IMAGE DOWNLOAD ERROR:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to download cartoon image",
      });
    }

    console.log("📦 Image downloaded. Size:", buffer.length, "bytes");

    /* =======================
       STEP 4 — UPLOAD TO SUPABASE
    ======================= */
    console.log("☁️ Step 3: Uploading to Supabase storage...");

    const fileName = `avatar-${Date.now()}.png`;

    let uploadResult;
    try {
      uploadResult = await supabase.storage
        .from("cartoonizer")
        .upload(fileName, buffer, {
          contentType: "image/png",
          upsert: true,
        });
    } catch (err) {
      console.error("❌ SUPABASE UPLOAD ERROR:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to upload image to Supabase",
      });
    }

    if (uploadResult.error) {
      console.error("❌ Supabase returned an error:", uploadResult.error);
      return res.status(500).json({
        success: false,
        error: "Supabase upload failed",
        details: uploadResult.error,
      });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/cartoonizer/${fileName}`;

    console.log("✅ Upload complete. Public URL:", publicUrl);

    /* =======================
       SUCCESS RESPONSE
    ======================= */
    return res.json({
      success: true,
      url: publicUrl,
    });

  } catch (err) {
    console.error("🔥 UNEXPECTED SERVER ERROR:", err?.response?.data || err);
    return res.status(500).json({
      success: false,
      error: "Unexpected server error",
      details: err?.response?.data || err,
    });
  }
});