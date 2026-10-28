/**
 * AI Omni-Solver - 1-Step Unified Web-Gated Solver (v3.0 - Anti-Spam & Multi-Tenant)
 * - Yêu cầu người dùng tự nhập API Key AI (Bảo vệ quota của Admin 100%)
 * - Chống lộ link & chống spam (Rate-limit 10 req/phút, bắt buộc License Key hợp lệ)
 * - Quản lý thu hồi / xóa Key từ xa (Remote Revocation API)
 */

const SECRET_HEX = "8f3d1a4c9b2e7f0156d8c4a3b7e9f2014d5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b";
const ZALO = "0344197212";
const ERR_MSG = "⚠️ Key chưa kích hoạt, đã hết hạn hoặc bị thu hồi! Liên hệ Admin - Zalo: 0344197212";

// Bộ nhớ đệm danh sách Key bị Admin thu hồi
let REVOKED_KEY_IDS = new Set(["REVOKED_SAMPLE_01"]);

// Bộ nhớ chống spam (Rate limit theo IP / License Key: Tối đa 10 req/phút)
const RATE_LIMIT_MAP = new Map();

export default {
  async fetch(request, env, ctx) {
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
        }
      });
    }

    const url = new URL(request.url);

    // 1. API ĐỒNG BỘ DANH SÁCH THU HỒI TỪ TRANG ADMIN (Bảo mật bằng SECRET_HEX)
    if (request.method === "POST" && url.pathname === "/admin/sync-revoked") {
      const secret = request.headers.get("X-Admin-Secret") || "";
      if (secret !== SECRET_HEX) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const body = await request.json();
        if (Array.isArray(body.revoked_ids)) {
          REVOKED_KEY_IDS = new Set(body.revoked_ids);
          return new Response(JSON.stringify({ status: "success", count: REVOKED_KEY_IDS.size }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      } catch (e) {}
      return new Response("Bad Request", { status: 400 });
    }

    if (request.method === "GET") {
      return new Response("🛡️ AI Omni-Solver Gateway Active (Protected)", {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    if (request.method === "POST") {
      try {
        // --- CHỐNG SPAM: RATE LIMIT 10 REQUEST / PHÚT ---
        const now = Date.now();
        const clientHistory = RATE_LIMIT_MAP.get(clientIP) || [];
        const recentRequests = clientHistory.filter(t => now - t < 60000);
        if (recentRequests.length >= 10) {
          return new Response("⚠️ Bạn đang gửi yêu cầu quá nhanh! Vui lòng chờ 30 giây rồi thử lại.", {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }
        recentRequests.push(now);
        RATE_LIMIT_MAP.set(clientIP, recentRequests);

        const body = await request.json().catch(() => ({}));
        const licKey = (body.license_key || "").trim();
        const apiKey = (body.api_key || "").trim(); // NGƯỜI DÙNG TỰ NHẬP API KEY
        const ocrText = (body.ocr_text || "").trim();
        const devId = (body.device_id || "ANY").trim();

        // 1. KIỂM TRA 5 LỚP LICENSE KEY (BẮT BUỘC CÓ KEY MỚI ĐƯỢC CHẠY TIẾP)
        const auth = await verifyKey(licKey, devId);
        if (!auth.valid) {
          return new Response(auth.message, {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        // 2. YÊU CẦU NGƯỜI DÙNG TỰ NHẬP API KEY (CHỐNG LÀM HAO HỤT QUOTA ADMIN)
        if (!apiKey) {
          return new Response("⚠️ Bạn chưa nhập API Key AI! Hãy dán mã Groq (gsk_...) hoặc Gemini (AIza.../AQ...) vào cài đặt Phím tắt.", {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        // 3. GIẢI ĐỀ BẰNG CHÍNH API KEY CỦA NGƯỜI DÙNG
        const answer = await solveWithAI(apiKey, ocrText);
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

  // Layer 1: Chữ ký HMAC-SHA256 (Chống làm giả key)
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

    const kid = data.id || "";
    // Layer 5: Kiểm tra danh sách Admin thu hồi từ xa
    if (REVOKED_KEY_IDS.has(kid)) {
      return { valid: false, message: `⚠️ Key [${kid}] đã bị Admin thu hồi vĩnh viễn! Liên hệ Zalo: ${ZALO}` };
    }

    // Layer 3: Kiểm tra thời hạn
    const now = Math.floor(Date.now() / 1000);
    if (now > data.exp) return { valid: false, message: ERR_MSG };

    // Layer 4: Khóa theo thiết bị
    if (data.dev !== "ANY" && devId !== "ANY" && data.dev !== devId) {
      return { valid: false, message: `⚠️ Key này bị khóa vào máy khác (${data.dev})! Liên hệ Zalo: ${ZALO}` };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, message: ERR_MSG };
  }
}

async function solveWithAI(apiKey, ocrText) {
  const prompt = `You are an elite instant exam solver. Solve all questions in the text with 100% accuracy.
OUTPUT FORMAT RULE: Output ONLY the final answers (e.g. 9B 10D 11A 12B 13A 14C 15B 16B 17D 18C 19C 20B) or short keyword/number.
Do NOT explain, do NOT write markdown or pleasantries. Output final answers only.`;

  // 1. Groq (Khuyên dùng - Siêu tốc 0.2s với Qwen 3.8 / GPT-OSS)
  if (apiKey.startsWith("gsk_")) {
    const groqModels = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];
    for (const m of groqModels) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "User-Agent": "AI_OmniSolver/1.0"
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: `Đề bài thi:\n${ocrText}\n\nGiải ngay:` }
            ],
            temperature: 0.1
          })
        });
        const d = await res.json();
        const ans = d.choices?.[0]?.message?.content;
        if (ans) return clean(ans);
      } catch (e) {}
    }
  }

  // 2. Google Gemini (Nếu khách nhập key AIza... hoặc AQ...)
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.") || apiKey.startsWith("AI")) {
    const geminiModels = ["gemma-4-26b-a4b-it", "gemini-flash-latest", "gemini-2.5-flash"];
    for (const m of geminiModels) {
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

  // 3. OpenAI / DeepSeek (sk-...)
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

  return "⚠️ API Key AI không hợp lệ hoặc hết hạn! Hãy kiểm tra lại mã Groq/Gemini.";
}

function clean(txt) {
  return txt.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```[a-z]*\n?|```/gi, "").trim();
}

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}
