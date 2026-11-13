
const MAX_BRIEF_LENGTH = 12000;
const MAX_FILE_LENGTH = 100000;

function sendJSON(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(data));
}

function cleanGeneratedText(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/^```(?:json|html|css|javascript|js)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJSON(text) {
  const cleaned = cleanGeneratedText(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("The AI did not return valid JSON.");
    }

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }
}

function validateFiles(data) {
  if (!data || typeof data !== "object") {
    throw new Error("The AI returned an invalid website response.");
  }

  const files = data.files || data;

  const html = cleanGeneratedText(files.html || files["index.html"]);
  const css = cleanGeneratedText(files.css || files["style.css"]);
  const js = cleanGeneratedText(files.js || files["script.js"]);

  if (!html || !css || !js) {
    throw new Error(
      "The AI did not generate all three website files. Please try again."
    );
  }

  if (
    html.length > MAX_FILE_LENGTH ||
    css.length > MAX_FILE_LENGTH ||
    js.length > MAX_FILE_LENGTH
  ) {
    throw new Error(
      "The generated website is too large. Please try a shorter description."
    );
  }

  if (!/<html[\s>]/i.test(html) && !/<!doctype html/i.test(html)) {
    throw new Error("The generated HTML file is incomplete.");
  }

  return { html, css, js };
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
      error: "Website Builder is not configured. The Gemini API key is missing."
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
      error: "Please provide your website project details."
    });
  }

  let briefText;

  try {
    briefText = JSON.stringify(brief);
  } catch {
    return sendJSON(res, 400, {
      success: false,
      error: "The website description could not be read."
    });
  }

  if (briefText.length > MAX_BRIEF_LENGTH) {
    return sendJSON(res, 400, {
      success: false,
      error: "Your website description is too long. Please shorten it."
    });
  }

  const prompt = `
You are Joseph AI's professional website development engine.

Create a complete, polished, modern, responsive FRONTEND website using the project details below.

PROJECT DETAILS:
${briefText}

YOUR TASK:
Return exactly one valid JSON object with these three string properties:

{
  "html": "Complete HTML document",
  "css": "Complete CSS stylesheet",
  "js": "Complete JavaScript file"
}

WEBSITE QUALITY REQUIREMENTS:

1. Make the design look like a professional website built for a real paying client.
2. Create a strong visual identity based on the requested business, style and colour palette.
3. Use polished spacing, typography, visual hierarchy, attractive sections, buttons, cards and navigation.
4. Make the first screen especially attractive, with a clear headline and useful call to action.
5. Make the website responsive on mobile phones, tablets and desktop screens.
6. Use semantic HTML and accessible labels, keyboard-friendly controls and sensible colour contrast.
7. Include all requested features and sections where possible.
8. Add working frontend interactions using vanilla JavaScript.
9. Make mobile navigation work if the design includes a mobile menu.
10. Add useful hover, focus and active states.
11. Use CSS for visual effects and tasteful animation. Avoid excessive animation.
12. Use real, relevant image URLs from reliable public image sources only when needed. Do not invent local image paths.
13. Do not include external JavaScript libraries or frameworks.
14. Do not include tracking scripts, analytics, hidden data collection or malicious code.
15. Do not invent business phone numbers, email addresses, physical addresses, customer reviews, awards or factual claims.
16. If business information is missing, use clearly labelled editable placeholders such as [Your phone number] or [Business address].
17. Do not claim that payments, account registration, database storage, bookings, order processing or other backend services work unless a real backend integration has been supplied. For frontend-only forms, provide a clear demo or contact-ready interaction without pretending data has been saved.
18. Keep the code organized, readable and complete.

HTML REQUIREMENTS:
- Include a complete HTML5 document.
- Include viewport and useful SEO metadata.
- Link to style.css.
- Load script.js near the end of the body with defer or a script tag.
- Do not put the entire CSS or JavaScript inside the HTML.
- Do not use markdown fences.

CSS REQUIREMENTS:
- Return the complete stylesheet.
- Include responsive breakpoints.
- Avoid unfinished styles and generic unstyled layouts.

JAVASCRIPT REQUIREMENTS:
- Return the complete JavaScript file.
- Avoid errors when optional elements are absent.
- Make every visible interactive control work where possible.
- Do not use fake backend functionality.

OUTPUT RULES:
- Return only valid JSON.
- Do not add explanations before or after the JSON.
- All three properties must contain complete code strings.
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

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
          temperature: 0.7,
          responseMimeType: "application/json",
          maxOutputTokens: 16000
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      const providerMessage =
        result?.error?.message || "The AI service returned an error.";

      console.error("Gemini Website Builder error:", response.status, providerMessage);

      return sendJSON(res, 502, {
        success: false,
        error: "The website generator could not complete your request. Please try again later."
      });
    }

    const generatedText =
      result?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim() || "";

    if (!generatedText) {
      return sendJSON(res, 502, {
        success: false,
        error: "The AI returned an empty response. Please try again with a shorter brief."
      });
    }

    let parsed;

    try {
      parsed = extractJSON(generatedText);
    } catch (error) {
      console.error("Website Builder JSON parsing failed:", error.message);

      return sendJSON(res, 502, {
        success: false,
        error: "The AI response could not be converted into website files. Please try again."
      });
    }

    let files;

    try {
      files = validateFiles(parsed);
    } catch (error) {
      return sendJSON(res, 502, {
        success: false,
        error: error.message
      });
    }

    return sendJSON(res, 200, {
      success: true,
      files,
      model,
      note: "These are frontend website files. Real database, login, payment and order services require separate backend integrations."
    });

  } catch (error) {
    if (error.name === "AbortError") {
      return sendJSON(res, 504, {
        success: false,
        error: "Website generation took too long. Please try again with a shorter description."
      });
    }

    console.error("Website Builder server error:", error);

    return sendJSON(res, 500, {
      success: false,
      error: "An unexpected server error occurred while generating your website."
    });

  } finally {
    clearTimeout(timeout);
  }
}
  
