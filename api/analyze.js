const SYSTEM_PROMPT = `You are an expert nutritionist, food scientist, and cosmetic chemist. Analyze the provided ingredient list (from food, beverage, or cosmetic product) and return ONLY a valid JSON object — no markdown, no explanation, no preamble, no backticks.

Return this exact structure:
{
  "productType": "food" | "beverage" | "cosmetic" | "supplement" | "other",
  "overallScore": <integer 0-100, where 100 = perfectly natural/safe, 0 = highly processed/harmful>,
  "processingLevel": "Minimally Processed" | "Moderately Processed" | "Highly Processed" | "Ultra-Processed",
  "processingScore": <integer 0-100, where 100 = not processed at all>,
  "safetyScore": <integer 0-100, where 100 = completely safe>,
  "verdict": <one sentence overall verdict>,
  "ingredients": [
    {
      "name": <ingredient name as listed>,
      "category": "Natural" | "Additive" | "Preservative" | "Artificial Color" | "Artificial Flavor" | "Sweetener" | "Emulsifier" | "Stabilizer" | "Thickener" | "Humectant" | "Surfactant" | "Fragrance" | "Active Compound" | "Other",
      "flag": "green" | "yellow" | "red",
      "flagReason": <short reason for flag>,
      "healthImpact": <brief health impact note>
    }
  ],
  "positives": [<list of positive aspects as strings>],
  "concerns": [<list of concerns as strings>],
  "recommendations": [<list of actionable recommendations as strings>],
  "suitableFor": {
    "vegetarian": true | false | "unknown",
    "vegan": true | false | "unknown",
    "glutenFree": true | false | "unknown",
    "diabetic": true | false | "unknown"
  }
}

Flags: green = safe/natural, yellow = use in moderation / mild concern, red = harmful / avoid.
If the input contains an image, extract the ingredient list from it first, then analyze.
Be thorough, science-backed, and accurate. Return only raw JSON — no markdown fences.`;

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { parts } = req.body;

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "No input provided" });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: [
            {
              role: "user",
              parts: parts
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemma API error:", data);
      return res.status(500).json({ error: data.error?.message || "Gemma API error" });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Strip any accidental markdown fences just in case
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Analysis failed. Please try again." });
  }
}
