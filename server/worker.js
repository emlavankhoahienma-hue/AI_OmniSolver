/**
 * AI Omni-Solver - 1-Step Unified Web-Gated Solver & Anti-Cheat Engine
 * Deploy to Cloudflare Workers / Vercel Edge / Node.js
 */
const SECRET_HEX = "8f3d1a4c9b2e7f0156d8c4a3b7e9f2014d5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b";
const ZALO = "0344197212";
const ERR_MSG = "⚠️ Key chưa kích hoạt hoặc đã hết hạn! Liên hệ Admin để mua Key - Zalo: 0344197212";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    if (request.method === "GET") {
      return new Response(JSON.stringify({ name: "AI Omni-Solver Gate", status: "ready" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    if (request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const licKey = (body.license_key || "").trim();
        const apiKey = (body.api_key || "").trim();
        const ocrText = (body.ocr_text || "").trim();
        const imageBase64 = (body.image_base64 || "").trim();
        const devId = (body.device_id || "ANY").trim();

        // 1. VERIFY 5-LAYER ANTI-CHEAT
        const auth = await verifyKey(licKey, devId);
        if (!auth.valid) {
          return new Response(JSON.stringify({ result: auth.message }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        // 2. DISPATCH TO MULTI-AI / POLLINATIONS
        const answer = await solveWithAI(apiKey, ocrText, imageBase64);
        return new Response(JSON.stringify({ result: answer }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ result: ERR_MSG }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  }
};

async function verifyKey(keyStr, devId) {
  if (!keyStr || !keyStr.startsWith("OMNI-")) return { valid: false, message: ERR_MSG };
  const parts = keyStr.split("-");
  if (parts.length !== 3) return { valid: false, message: ERR_MSG };
  const [_, pHex, sig] = parts;

  // Layer 1: HMAC check
  const secretBytes = hexToBytes(SECRET_HEX);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expectedSigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(pHex));
  const expectedSig = Array.from(new Uint8Array(expectedSigBytes)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
  if (sig !== expectedSig) return { valid: false, message: ERR_MSG };

  // Decode Payload
  try {
    const obfBytes = hexToBytes(pHex);
    const hash = await crypto.subtle.digest("SHA-256", new Uint8Array([...secretBytes, ...encoder.encode(":KEYSTREAM")]));
    const keystream = new Uint8Array(hash);
    const payloadBytes = new Uint8Array(obfBytes.length);
    for (let i = 0; i < obfBytes.length; i++) payloadBytes[i] = obfBytes[i] ^ keystream[i % keystream.length];
    const data = JSON.parse(new TextDecoder().decode(payloadBytes));

    const now = Math.floor(Date.now() / 1000);
    if (now > data.exp) return { valid: false, message: ERR_MSG };
    if (data.dev !== "ANY" && devId !== "ANY" && data.dev !== devId) return { valid: false, message: ERR_MSG };
    return { valid: true };
  } catch (e) {
    return { valid: false, message: ERR_MSG };
  }
}

async function solveWithAI(apiKey, ocrText, imageBase64) {
  const prompt = `You are an elite quiz solver. Analyze image and OCR text. Output ONLY compact answers: "1B 2C 3A 4D" or short number/word. Never explain.`;
  const content = [{ type: "text", text: `OCR: ${ocrText}\nSolve now:` }];
  if (imageBase64) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });

  // Gemini if AIza...
  if (apiKey.startsWith("AIza")) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gemini-2.5-flash", messages: [{ role: "system", content: prompt }, { role: "user", content }] })
      });
      const d = await res.json();
      const ans = d.choices?.[0]?.message?.content;
      if (ans) return clean(ans);
    }} catch (e) {}
  }

  // OpenRouter if sk-or-...
  if (apiKey.startsWith("sk-or-")) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: prompt }, { role: "user", content }] })
      });
      const d = await res.json();
      const ans = d.choices?.[0]?.message?.content;
      if (ans) return clean(ans);
    }} catch (e) {}
  }

  // Groq if gsk_...
  if (apiKey.startsWith("gsk_")) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "llama-3.2-11b-vision-preview", messages: [{ role: "system", content: prompt }, { role: "user", content }] })
      });
      const d = await res.json();
      const ans = d.choices?.[0]?.message?.content;
      if (ans) return clean(ans);
    }} catch (e) {}
  }

  // Fallback: Pollinations AI (Zero Key Needed)
  const polRes = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: prompt }, { role: "user", content }] })
  });
  const polData = await polRes.json();
  return clean(polData.choices?.[0]?.message?.content || "Không nhận diện được đáp án");
}

function clean(txt) {
  return txt.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```[a-z]*\n?|```/gi, "").trim();
}

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}
