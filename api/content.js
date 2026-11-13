
function sendJSON(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return sendJSON(res, 405, {
      success: false,
      error: "Only POST requests are supported."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  if (!apiKey) {
    return sendJSON(res, 500, {
      success: false,
      error: "Content Creator is not configured. The Gemini API key is missing."
    });
  }

  const body = req.body || {};

  if (body.action !== "generate") {
    return sendJSON(res, 400, {
      success: false,
      error: "Unsupported action. Use action: generate."
    });
  }

  const brief = body.brief;

  if (!brief || typeof brief !== "object" || Array.isArray(brief)) {
    return sendJSON(res, 400, {
      success: false,
      error: "Please provide your content details."
    });
  }

  let briefText;

  try {
    briefText = JSON.stringify(brief);
  } catch {
    return sendJSON(res, 400, {
      success: false,
      error: "Your content details could not be read."
    });
  }

  if (briefText.length > 12000) {
    return sendJSON(res, 400, {
      success: false,
      error: "Your content instructions are too long. Please shorten them."
    });
  }

  const prompt = `
You are Joseph AI's professional Content Creation engine.

Create high-quality, original, useful content based on the user's instructions.

USER'S CONTENT REQUEST:
${briefText}

CONTENT QUALITY REQUIREMENTS:

1. Understand the requested content type, platform, audience, tone, subject and goal.
2. Write naturally, clearly and professionally.
3. Make the content engaging and suitable for its intended audience.
4. Use an appropriate structure for the requested content type.
5. For social media, create an attention-grabbing opening and a suitable call to action.
6. For advertisements, clearly communicate the product or service's value without making unsupported promises.
7. For articles, use meaningful headings, useful explanations and a logical flow.
8. For product descriptions, highlight supplied features and benefits without inventing specifications.
9. For video scripts, include a strong opening, organized scenes or talking points, and a clear ending.
10. Use emojis and hashtags only when suitable for the platform and tone.
11. Respect the requested length. If no length is specified, produce a useful, reasonably detailed result.
12. Do not invent prices, addresses, phone numbers, statistics, testimonials, awards, guarantees or business facts.
13. If important information is missing, use a clearly labelled placeholder such as [Insert phone number] instead of making something up.
14. Do not claim that a product or service has features that the user did not provide.
15. Do not include explanations about how you generated the content unless the user requests them.
16. Return the finished content itself, ready for the user to review and use.

Return only the finished content as plain text.
Do not wrap the answer in JSON or markdown code fences.
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 5000
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      const providerMessage =
        result?.error?.message || "The AI service returned an error.";

      console.error("Gemini Content Creator error:", response.status, providerMessage);

      return sendJSON(res, 502, {
        success: false,
        error: "The content generator could not complete your request. Please try again later."
      });
    }

    const content =
      result?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim() || "";

    if (!content) {
      return sendJSON(res, 502, {
        success: false,
        error: "The AI returned an empty response. Please try again."
      });
    }

    return sendJSON(res, 200, {
      success: true,
      content,
      model
    });

  } catch (error) {
    if (error.name === "AbortError") {
      return sendJSON(res, 504, {
        success: false,
        error: "Content generation took too long. Please try again."
      });
    }

    console.error("Content Creator server error:", error);

    return sendJSON(res, 500, {
      success: false,
      error: "An unexpected server error occurred while creating your content."
    });

  } finally {
    clearTimeout(timeout);
  }
}
  
