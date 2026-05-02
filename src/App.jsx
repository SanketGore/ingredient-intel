import { useState, useRef, useCallback } from "react";

export default function IngredientAnalyzer() {
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleImageUpload = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setImage({ data: base64, mimeType: file.type });
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleImageUpload(file);
  }, []);

  const analyze = async () => {
    if (!input.trim() && !image) {
      setError("Please enter an ingredient list or upload a label photo.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    // Build parts array for the Gemma API
    const parts = [];
    if (image) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
      parts.push({
        text: input.trim()
          ? `This is an image of a product label. Additional text provided: ${input}. Please extract the ingredient list from the image and analyze it.`
          : "This is an image of a product label. Please extract the ingredient list from the image and analyze it."
      });
    } else {
      parts.push({ text: `Analyze these ingredients:\n\n${input.trim()}` });
    }

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setActiveTab("overview");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearImage = (e) => {
    e.stopPropagation();
    setImage(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const scoreColor = (s) => s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#ef4444";
  const flagDot   = (f) => f === "green" ? "#22c55e" : f === "yellow" ? "#f59e0b" : "#ef4444";
  const flagBg    = (f) => f === "green" ? "#f0fdf4" : f === "yellow" ? "#fffbeb" : "#fef2f2";
  const flagBorder= (f) => f === "green" ? "#bbf7d0" : f === "yellow" ? "#fde68a" : "#fecaca";

  const processColor = (level) => {
    if (level?.includes("Ultra"))    return { bg: "#fef2f2", text: "#dc2626" };
    if (level?.includes("Highly"))   return { bg: "#fff7ed", text: "#ea580c" };
    if (level?.includes("Moderate")) return { bg: "#fefce8", text: "#ca8a04" };
    return { bg: "#f0fdf4", text: "#16a34a" };
  };

  const suitIcon  = (v) => v === true ? "✓" : v === false ? "✗" : "—";
  const suitColor = (v) => v === true ? "#16a34a" : v === false ? "#dc2626" : "#9ca3af";

  // ─── Score Ring ─────────────────────────────────────────────────────────────
  const ScoreRing = ({ score, label }) => {
    const r = 32, size = 80, circ = 2 * Math.PI * r;
    const fill = (score / 100) * circ;
    const color = scoreColor(score);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={40} cy={40} r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
          <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }} />
          <text x={40} y={40} fill={color} fontSize="17" fontWeight="800"
            textAnchor="middle" dominantBaseline="middle"
            style={{ transform: "rotate(90deg)", transformOrigin: "40px 40px", fontFamily: "inherit" }}>
            {score}
          </text>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>
          {label}
        </span>
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f1f5f9", color: "#1e293b" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        textarea:focus { outline: none; }
        button:active { transform: scale(0.98); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .tab-btn:hover { background: #f8fafc !important; }
        .analyze-btn:hover { filter: brightness(1.08); }
        .ingredient-card:hover { transform: translateX(3px); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a3050 50%, #0f172a 100%)", padding: "32px 24px 28px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.2)", borderRadius: 20, padding: "4px 12px", marginBottom: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "#7dd3fc", textTransform: "uppercase" }}>Powered by Gemma 3 · Google AI</span>
        </div>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 36, fontWeight: 400, color: "#fff", margin: 0, lineHeight: 1.1 }}>
          Ingredient Intel
        </h1>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 8, marginBottom: 0, fontWeight: 500 }}>
          Decode what's really in your food, drinks & cosmetics
        </p>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* ── Input Card ── */}
        <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0", marginBottom: 14 }}>

          <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", display: "block", marginBottom: 8 }}>
            Paste Ingredients
          </label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g. Water, Sugar, Modified Corn Starch, Sodium Benzoate, Citric Acid, Natural Flavor..."
            rows={4}
            style={{
              width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10,
              padding: "11px 13px", fontSize: 14, resize: "vertical", color: "#334155",
              background: "#f8fafc", fontFamily: "inherit", lineHeight: 1.6,
              transition: "border-color 0.2s"
            }}
            onFocus={e => e.target.style.borderColor = "#3b82f6"}
            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
          />

          <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", display: "block", margin: "14px 0 8px" }}>
            Or Upload Label Photo
          </label>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${dragOver ? "#3b82f6" : "#cbd5e1"}`,
              borderRadius: 12, overflow: "hidden", cursor: "pointer",
              background: dragOver ? "#eff6ff" : "#f8fafc",
              transition: "all 0.2s", padding: imagePreview ? 0 : "20px 16px",
              textAlign: "center"
            }}
          >
            {imagePreview ? (
              <div style={{ position: "relative" }}>
                <img src={imagePreview} alt="Label" style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block", borderRadius: 10 }} />
                <button onClick={clearImage} style={{
                  position: "absolute", top: 8, right: 8, background: "rgba(15,23,42,0.7)",
                  color: "#fff", border: "none", borderRadius: "50%", width: 30, height: 30,
                  cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center"
                }}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>Drop image here or tap to browse</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>JPG, PNG, WEBP — photos of ingredient labels</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e.target.files[0])} />

          <button
            className="analyze-btn"
            onClick={analyze}
            disabled={loading}
            style={{
              marginTop: 14, width: "100%", padding: "14px",
              borderRadius: 11, border: "none",
              background: loading ? "#94a3b8" : "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.02em", transition: "all 0.2s", fontFamily: "inherit",
              boxShadow: loading ? "none" : "0 4px 14px rgba(37,99,235,0.3)"
            }}
          >
            {loading ? "Analyzing…" : "🔬 Analyze Ingredients"}
          </button>
          {error && <div style={{ marginTop: 10, color: "#ef4444", fontSize: 13, textAlign: "center", fontWeight: 500 }}>{error}</div>}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12, display: "inline-block", animation: "spin 2.5s linear infinite" }}>⚗️</div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>Gemma is decoding your ingredients…</div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 5 }}>Cross-referencing nutritional & cosmetic science</div>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>

            {/* Score Card */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>
                    {result.productType}
                  </div>
                  <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, fontWeight: 500 }}>{result.verdict}</div>
                </div>
                <div style={{
                  ...processColor(result.processingLevel),
                  fontSize: 10, fontWeight: 800, padding: "5px 10px",
                  borderRadius: 20, letterSpacing: "0.05em", whiteSpace: "nowrap", flexShrink: 0
                }}>
                  {result.processingLevel}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                <ScoreRing score={result.overallScore}    label="Overall"  />
                <ScoreRing score={result.safetyScore}     label="Safety"   />
                <ScoreRing score={result.processingScore} label="Natural"  />
              </div>
            </div>

            {/* Suitability */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 12 }}>Suitability</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(result.suitableFor).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: suitColor(val), lineHeight: 1 }}>{suitIcon(val)}</span>
                    <span style={{ fontSize: 13, color: "#475569", fontWeight: 500, textTransform: "capitalize" }}>
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                {[
                  { id: "overview",     label: "📊 Overview"     },
                  { id: "ingredients",  label: "🧪 Ingredients"  },
                  { id: "advice",       label: "💡 Advice"       }
                ].map(tab => (
                  <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
                    flex: 1, padding: "12px 6px", border: "none",
                    background: activeTab === tab.id ? "#fff" : "transparent",
                    color: activeTab === tab.id ? "#1d4ed8" : "#64748b",
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    fontSize: 12, cursor: "pointer", letterSpacing: "0.04em",
                    borderBottom: activeTab === tab.id ? "2px solid #2563eb" : "2px solid transparent",
                    transition: "all 0.15s", fontFamily: "inherit"
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: 16 }}>

                {/* Overview */}
                {activeTab === "overview" && (
                  <div>
                    {result.positives?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>✅ Positives</div>
                        {result.positives.map((p, i) => (
                          <div key={i} style={{ padding: "9px 12px", background: "#f0fdf4", borderRadius: 9, borderLeft: "3px solid #22c55e", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: "#166534", lineHeight: 1.5 }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {result.concerns?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>⚠️ Concerns</div>
                        {result.concerns.map((c, i) => (
                          <div key={i} style={{ padding: "9px 12px", background: "#fef2f2", borderRadius: 9, borderLeft: "3px solid #ef4444", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Ingredients */}
                {activeTab === "ingredients" && (
                  <div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      {["green", "yellow", "red"].map(f => (
                        <div key={f} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: flagDot(f) }} />
                          {f === "green" ? "Safe" : f === "yellow" ? "Moderate" : "Concern"}
                          <span style={{ color: flagDot(f) }}>({result.ingredients?.filter(i => i.flag === f).length})</span>
                        </div>
                      ))}
                    </div>
                    {result.ingredients?.map((ing, i) => (
                      <div key={i} className="ingredient-card" style={{
                        padding: "10px 12px", borderRadius: 10, marginBottom: 8,
                        background: flagBg(ing.flag), border: `1px solid ${flagBorder(ing.flag)}`,
                        transition: "transform 0.15s"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: flagDot(ing.flag), flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{ing.name}</span>
                          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginLeft: "auto", textAlign: "right" }}>{ing.category}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, paddingLeft: 15 }}>{ing.flagReason}</div>
                        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, paddingLeft: 15 }}>{ing.healthImpact}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Advice */}
                {activeTab === "advice" && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>💡 Recommendations</div>
                    {result.recommendations?.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "10px 12px", background: "#eff6ff", borderRadius: 10, borderLeft: "3px solid #3b82f6" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8", minWidth: 22 }}>{i + 1}.</span>
                        <span style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.6 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 14, lineHeight: 1.6 }}>
              Analysis by Gemma 3 27B · For clinical decisions, consult a qualified professional.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
