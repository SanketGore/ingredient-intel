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
Be thorough, science-backed, and accurate. Return only raw JSON — no markdown fences.`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "MISSING_API_KEY: GROQ_API_KEY is not set in Vercel." });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "No ingredient text provided." });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gemma2-9b-it",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Analyze these ingredients:\n\n${text}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2048
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `Groq returned status ${response.status}`);
    }

    const raw    = data.choices?.[0]?.message?.content || "{}";
    const clean  = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    parsed._modelUsed = "gemma2-9b-it (Groq)";

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Handler error:", err.message);
    return res.status(500).json({ error: `API_ERROR: ${err.message}` });
  }
};
