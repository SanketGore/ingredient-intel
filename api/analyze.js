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

const MODELS = [
  { name: "gemma-3-27b-it",   label: "Gemma 3 27B"      },
  { name: "gemini-2.0-flash", label: "Gemini 2.0 Flash" }
];

async function callModel(modelName, parts, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 2048
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Model ${modelName} returned status ${response.status}`);
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const clean   = rawText.replace(/```json|```/g, "").trim();
  return { result: JSON.parse(clean), usedModel: modelName };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // ── Diagnostic check — confirms if env variable is present ──
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "MISSING_API_KEY: GEMINI_API_KEY environment variable is not set in Vercel."
    });
  }

  const { parts } = req.body;
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "No input provided" });
  }

  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model.label}`);
      const { result, usedModel } = await callModel(model.name, parts, apiKey);
      console.log(`Success with: ${model.label}`);
      result._modelUsed = usedModel;
      return res.status(200).json(result);
    } catch (err) {
      console.warn(`${model.label} failed: ${err.message}`);
      lastError = err;
    }
  }

  console.error("All models failed:", lastError?.message);
  return res.status(500).json({
    error: `API_ERROR: ${lastError?.message || "All models failed. Please try again."}`
  });
};
