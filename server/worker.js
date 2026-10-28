/**
 * AI Omni-Solver - 1-Step Unified Web-Gated Solver (v3.5 - Omni-Question Format)
 * Hỗ trợ toàn diện mọi dạng đề:
 * 1. Trắc nghiệm 4 lựa chọn (A, B, C, D)
 * 2. Trắc nghiệm Đúng / Sai (Format thi tốt nghiệp mới: aĐ bS cĐ dS)
 * 3. Điền đáp số / Trả lời ngắn / Tính toán
 */

const SECRET_HEX = "8f3d1a4c9b2e7f0156d8c4a3b7e9f2014d5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b";
const ZALO = "0344197212";
const ERR_MSG = "⚠️ Key chưa kích hoạt, đã hết hạn hoặc bị thu hồi! Liên hệ Admin - Zalo: 0344197212";

// Bộ nhớ đệm danh sách Key bị Admin thu hồi
let REVOKED_KEY_IDS = new Set(["REVOKED_SAMPLE_01"]);

// Bộ nhớ chống spam (Rate limit theo IP: Tối đa 10 req/phút)
const RATE_LIMIT_MAP = new Map();

export default {
  async fetch(request, env, ctx) {
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

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

    // 1. API ĐỒNG BỘ DANH SÁCH THU HỒI TỪ TRANG ADMIN
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
      return new Response("🛡️ AI Omni-Solver Gateway v3.5 Active", {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    if (request.method === "POST") {
      try {
        // CHỐNG SPAM: RATE LIMIT 10 REQUEST / PHÚT
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
        const apiKey = (body.api_key || "").trim();
        const ocrText = (body.ocr_text || "").trim();
        const devId = (body.device_id || "ANY").trim();

        // 1. KIỂM TRA 5 LỚP LICENSE KEY
        const auth = await verifyKey(licKey, devId);
        if (!auth.valid) {
          return new Response(auth.message, {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        // 2. YÊU CẦU NGƯỜI DÙNG TỰ NHẬP API KEY
        if (!apiKey) {
          return new Response("⚠️ Bạn chưa nhập API Key AI! Hãy dán mã Groq (gsk_...) vào cài đặt Phím tắt.", {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        // 3. GIẢI MỌI DẠNG ĐỀ QUA AI SIÊU TỐC
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
    if (REVOKED_KEY_IDS.has(kid)) {
      return { valid: false, message: `⚠️ Key [${kid}] đã bị Admin thu hồi vĩnh viễn! Liên hệ Zalo: ${ZALO}` };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > data.exp) return { valid: false, message: ERR_MSG };

    if (data.dev !== "ANY" && devId !== "ANY" && data.dev !== devId) {
      return { valid: false, message: `⚠️ Key này bị khóa vào máy khác (${data.dev})! Liên hệ Zalo: ${ZALO}` };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, message: ERR_MSG };
  }
}

async function solveWithAI(apiKey, ocrText) {
  const prompt = `Bạn là trợ lý giải đề thi siêu tốc chuyên nghiệp. Giải toàn bộ câu hỏi với độ chính xác 100%.
QUY TẮC ĐỊNH DẠNG ĐÁP ÁN (BẮT BUỘC SIÊU GỌN TRÊN 1 DÒNG ĐỂ HIỆN THÔNG BÁO IPHONE):
1. Trắc nghiệm ABCD: Ghi số câu + chữ cái (VD: 1B 2C 3A 4D)
2. Trắc nghiệm Đúng/Sai (dạng a,b,c,d): Ghi "SốCâu: aĐ bS cĐ dS" (VD: 1: aĐ bS cĐ dS | 2: aS bĐ cS dĐ)
3. Trả lời ngắn / Điền số / Điền từ: Ghi "SốCâu: ĐápSố/TừKhóa" (VD: 1: 15.2 | 2: 120 | 3: hydrogen)
4. Nếu đề gồm nhiều phần kết hợp: Phân tách bằng dấu gạch dọc | (VD: [TN]: 1A 2B | [Đ/S]: 1: aĐ bS cĐ dS | [TL]: 1: 4.5)
TUYỆT ĐỐI KHÔNG giải thích, không viết markdown, chỉ xuất chuỗi đáp án cuối cùng!`;

  // 1. Groq (Chạy Qwen 3.8 / GPT-OSS 120B siêu tốc 0.2s)
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
              { role: "user", content: `Đề bài thi:\n${ocrText}\n\nGiải và xuất đáp án:` }
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

  // 2. Google Gemini (Nếu dùng key AIza... hoặc AQ...)
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
            { role: "user", content: `Đề bài thi:\n${ocrText}\n\nGiải và xuất đáp án:` }
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
  return txt
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[a-z]*\n?|```/gi, "")
    .replace(/^(Đáp án|Kết quả|Answer):\s*/im, "")
    .trim();
}

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}
