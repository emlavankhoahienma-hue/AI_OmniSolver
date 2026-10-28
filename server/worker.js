/**
 * AI Omni-Solver - 1-Step Unified Web-Gated Solver
 * Trả về Plain Text trực tiếp (Không dính ngoặc JSON)
 */
const SECRET_HEX = "8f3d1a4c9b2e7f0156d8c4a3b7e9f2014d5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b";
const ZALO = "0344197212";
const ERR_MSG = "⚠️ Key chưa kích hoạt hoặc đã hết hạn! Liên hệ Admin - Zalo: 0344197212";

// Dán API Key AI của bạn vào đây trên Cloudflare (Gemini AQ... hoặc AIza...):
const DEFAULT_AI_KEY = ""; 

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
      return new Response("AI Omni-Solver Server Online", {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    if (request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const licKey = (body.license_key || "").trim();
        const apiKey = (body.api_key || DEFAULT_AI_KEY || "").trim();
        const ocrText = (body.ocr_text || "").trim();
        const imageBase64 = (body.image_base64 || "").trim();
        const devId = (body.device_id || "ANY").trim();

        // 1. Kiểm tra 5 lớp License Key
        const auth = await verifyKey(licKey, devId);
        if (!auth.valid) {
          return new Response(auth.message, {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        // 2. Giải đề qua Đa AI
        const answer = await solveWithAI(apiKey, ocrText, imageBase64);
        return new Response(answer, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      } catch (err) {
        return new Response(ERR_MSG, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
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

  const secretBytes = hexToBytes(SECRET_HEX);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expectedSigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(pHex));
  const expectedSig = Array.from(new Uint8Array(expectedSigBytes)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
  if (sig !== expectedSig) return { valid: false, message: ERR_MSG };

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
  const prompt = `You are an elite quiz solver. Solve all questions in the text with 100% accuracy.
OUTPUT FORMAT: Output ONLY the compact answers (e.g., "9B 10D 11A 12B 13A 14C 15B 16B 17D 18C 19C 20B") or short keyword/number.
Do NOT explain, do NOT write markdown or preface. Output final answers only.`;

  // 1. Google Gemini (Hỗ trợ cả Key dạng mới AQ... và AIza...)
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.") || apiKey.startsWith("AI")) {
    const models = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    for (const m of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${prompt}\n\nĐề bài thi:\n${ocrText}` }]
            }]
          })
        });
        const data = await res.json();
        const ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (ans) return clean(ans);
      } catch (e) {}
    }
  }

  // 2. Groq (Siêu tốc 0.3s)
  if (apiKey.startsWith("gsk_")) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: `Đề bài:\n${ocrText}\n\nGiải ngay:` }
          ],
          temperature: 0.1
        })
      });
      const d = await res.json();
      const ans = d.choices?.[0]?.message?.content;
      if (ans) return clean(ans);
    } catch (e) {}
  }

  // 3. OpenRouter
  if (apiKey.startsWith("sk-or-")) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: `Đề bài:\n${ocrText}` }
          ]
        })
      });
      const d = await res.json();
      const ans = d.choices?.[0]?.message?.content;
      if (ans) return clean(ans);
    } catch (e) {}
  }

  // 4. OpenAI / DeepSeek (sk-...)
  if (apiKey.startsWith("sk-")) {
    try {
      const isDeepSeek = apiKey.length === 35 || apiKey.includes("deepseek");
      const endpoint = isDeepSeek ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
      const model = isDeepSeek ? "deepseek-chat" : "gpt-4o-mini";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: `Đề bài:\n${ocrText}` }
          ]
        })
      });
      const d = await res.json();
      const ans = d.choices?.[0]?.message?.content;
      if (ans) return clean(ans);
    } catch (e) {}
  }

  return "⚠️ Không kết nối được với AI. Hãy kiểm tra lại API Key!";
}

function clean(txt) {
  return txt.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```[a-z]*\n?|```/gi, "").trim();
}

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}
