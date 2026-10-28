/**
 * AI Omni-Solver - Multi-AI Smart Router & Failover Engine
 * Lightweight Cloudflare Worker / Edge Router
 * 
 * Auto-detects AI provider from API Key prefix:
 * - AIza...  -> Google Gemini (gemini-2.5-flash)
 * - sk-or-... -> OpenRouter (google/gemini-2.5-flash / qwen-vl)
 * - gsk_...   -> Groq Ultra-Fast (llama-4 / llama-3.2-vision)
 * - sk-...    -> OpenAI (gpt-4.1 / gpt-4o) / DeepSeek (deepseek-chat)
 * - Empty/Err -> Pollinations AI (Zero Key Fallback - 100% Uptime)
 */

const SYSTEM_PROMPT = `You are an elite, ultra-fast exam/quiz solver assistant.
Analyze the user's exam question from the screenshot image and the provided on-device OCR text.
Output ONLY the final answers in the most compact format possible.
RULES:
1. Multiple-choice questions: Output question number and letter option only, separated by space. Example: "1B 2C 3A 4D 5A"
2. Fill-in-the-blank / calculation / short answer: Output ONLY the exact number, formula or keyword on a single line.
3. NEVER write explanations, intros, greetings, or markdown codeblocks. Output the answer string ONLY.`;

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    // Health-check / UI endpoint
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        JSON.stringify(
          {
            name: "AI Omni-Solver Router",
            version: "2026.1",
            status: "online",
            providers: ["Gemini (AIza...)", "OpenRouter (sk-or-...)", "Groq (gsk_...)", "OpenAI/DeepSeek (sk-...)", "Pollinations AI (No Key Fallback)"],
            usage: "POST /solve with JSON { api_key, ocr_text, image_base64 }",
          },
          null,
          2
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (request.method === "POST" && (url.pathname === "/solve" || url.pathname === "/")) {
      try {
        const body = await request.json().catch(() => ({}));
        const apiKey = (body.api_key || "").trim();
        const ocrText = (body.ocr_text || "").trim();
        const imageBase64 = (body.image_base64 || "").trim();

        const result = await routeAndSolve(apiKey, ocrText, imageBase64);
        return new Response(JSON.stringify(result), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        // Ultimate fallback in case of router error
        return new Response(
          JSON.stringify({
            status: "error",
            message: err.message || "Internal solver error",
            result: "ERROR: Check connection or API key",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * Route request to detected AI provider with automatic failover
 */
async function routeAndSolve(apiKey, ocrText, imageBase64) {
  // Provider detection
  let provider = "pollinations";
  if (apiKey.startsWith("AIza")) {
    provider = "gemini";
  } else if (apiKey.startsWith("sk-or-")) {
    provider = "openrouter";
  } else if (apiKey.startsWith("gsk_")) {
    provider = "groq";
  } else if (apiKey.startsWith("sk-")) {
    // If user specifies deepseek in body or key format
    provider = apiKey.length === 35 || apiKey.includes("deepseek") ? "deepseek" : "openai";
  }

  // If apiKey is empty, directly use Pollinations AI
  if (!apiKey) {
    provider = "pollinations";
  }

  // Attempt primary provider
  try {
    let res = null;
    if (provider === "gemini") {
      res = await callGemini(apiKey, ocrText, imageBase64);
    } else if (provider === "openrouter") {
      res = await callOpenRouter(apiKey, ocrText, imageBase64);
    } else if (provider === "groq") {
      res = await callGroq(apiKey, ocrText, imageBase64);
    } else if (provider === "deepseek") {
      res = await callDeepSeek(apiKey, ocrText, imageBase64);
    } else if (provider === "openai") {
      res = await callOpenAI(apiKey, ocrText, imageBase64);
    }

    if (res && res.trim()) {
      return {
        status: "success",
        provider: provider,
        result: cleanResult(res),
      };
    }
  } catch (err) {
    console.warn(`Primary provider [${provider}] failed: ${err.message}. Triggering Pollinations fallback.`);
  }

  // Fallback to Pollinations AI (Zero Key Needed, 100% Uptime)
  try {
    const fallbackRes = await callPollinations(ocrText, imageBase64);
    return {
      status: "success",
      provider: "pollinations_fallback",
      result: cleanResult(fallbackRes),
    };
  } catch (err) {
    return {
      status: "partial",
      provider: "ocr_only",
      result: `[OCR text detected: ${ocrText.slice(0, 100)}...]`,
    };
  }
}

/**
 * Clean AI output: strip markdown backticks, <think> tags, extra preambles
 */
function cleanResult(text) {
  if (!text) return "";
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // Remove deepseek reasoning tags
    .replace(/```[a-z]*\n?|```/gi, "")        // Remove code blocks
    .replace(/^([Aa]nswer|[Đđ]áp án|[Kk]ết quả)\s*:\s*/im, "")
    .trim();
  
  // If multiline, take meaningful lines or single line
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    // If answers like 1A 2B 3C are on multiple lines, combine them cleanly
    const answerPattern = /^(\d+[\.\s]?[A-D]|[A-D])$/i;
    if (lines.every(l => answerPattern.test(l))) {
      return lines.join(" ");
    }
    return lines.join(" ");
  }
  return cleaned;
}

/**
 * 1. Google Gemini (via OpenAI-compatible endpoint)
 */
async function callGemini(apiKey, ocrText, imageBase64) {
  const content = [];
  content.push({
    type: "text",
    text: `Extracted on-device OCR text:\n${ocrText || "None"}\n\nSolve the exam question from image and OCR text.`
  });
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content }
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) throw new Error(`Gemini status ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 2. OpenRouter (Multi-model vision + fast fallback)
 */
async function callOpenRouter(apiKey, ocrText, imageBase64) {
  const content = [];
  content.push({
    type: "text",
    text: `Extracted on-device OCR text:\n${ocrText || "None"}\n\nSolve the exam question from image and OCR text.`
  });
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://shortcuts.apple.com",
      "X-Title": "AI_OmniSolver",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      models: ["google/gemini-2.5-flash", "qwen/qwen2.5-vl-72b-instruct:free", "meta-llama/llama-3.2-11b-vision-instruct:free"],
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content }
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter status ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 3. Groq (Ultra-fast inference)
 */
async function callGroq(apiKey, ocrText, imageBase64) {
  const content = [];
  content.push({
    type: "text",
    text: `Extracted OCR text:\n${ocrText || "None"}\n\nSolve the questions directly.`
  });
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: imageBase64 ? "llama-3.2-11b-vision-preview" : "meta-llama/llama-4-maverick-17b-128e-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content }
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) throw new Error(`Groq status ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 4. DeepSeek (Reasoning with on-device OCR text)
 */
async function callDeepSeek(apiKey, ocrText, imageBase64) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Exam OCR Content:\n${ocrText}\n\nSolve every question and output compact answers.`
        }
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek status ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 5. OpenAI (gpt-4.1 / gpt-4o)
 */
async function callOpenAI(apiKey, ocrText, imageBase64) {
  const content = [];
  content.push({
    type: "text",
    text: `Extracted OCR text:\n${ocrText || "None"}\n\nSolve questions.`
  });
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content }
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI status ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 6. Pollinations AI (Zero Key Fallback - 100% Free & Always Online)
 */
async function callPollinations(ocrText, imageBase64) {
  const content = [];
  content.push({
    type: "text",
    text: `On-Device OCR Text:\n${ocrText || "None"}\n\nSolve questions instantly.`
  });
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content }
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) throw new Error(`Pollinations status ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
