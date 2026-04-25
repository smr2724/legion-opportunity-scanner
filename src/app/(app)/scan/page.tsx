"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Zap } from "lucide-react";

const PRESETS: { label: string; keywords: string[] }[] = [
  { label: "Industrial Cleaners", keywords: ["industrial degreaser", "commercial degreaser", "equipment cleaner", "heavy duty cleaner"] },
  { label: "Specialty Removers", keywords: ["graffiti remover", "adhesive remover", "rust remover", "paint remover", "mold stain remover"] },
  { label: "Concrete / Masonry", keywords: ["concrete remover", "oil stain remover for concrete", "grout haze remover", "rust remover for concrete", "efflorescence remover"] },
  { label: "Janitorial / Facility", keywords: ["floor stripper", "commercial descaler", "no rinse disinfectant", "urinal deodorizer cake"] },
  { label: "Automotive / RV / Boat", keywords: ["boat hull cleaner", "RV roof cleaner", "wheel cleaner", "bug remover", "aluminum brightener"] },
  { label: "Commercial Kitchen", keywords: ["commercial kitchen degreaser", "oven cleaner commercial", "grill cleaner", "fryer boil out"] },
  { label: "Odor / Stain Control", keywords: ["odor eliminator", "mold stain remover", "pet odor eliminator industrial", "smoke odor eliminator"] },
  { label: "Restoration Supplies", keywords: ["asphalt release agent", "tar remover", "soot remover", "water damage treatment"] },
];

export default function ScanPage() {
  const router = useRouter();
  const [seed, setSeed] = useState("concrete remover");
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard");
  const [minVol, setMinVol] = useState("");
  const [maxReviews, setMaxReviews] = useState("");
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!seed.trim()) { setErr("Seed keyword required"); return; }
    setRunning(true);
    try {
      const res = await fetch("/api/scans/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed_keyword: seed.trim(), depth, min_search_volume: minVol,
          max_top10_reviews: maxReviews, include_keywords: include, exclude_keywords: exclude, notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Scan failed");
      router.push(`/opportunities/${data.opportunityId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Scan failed");
      setRunning(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">New Scan</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Enter a seed keyword. The scanner pulls Amazon demand + SERP, enriches top ASINs, scores the category, and generates a skeptical operator memo.</p>
      </div>

      <form onSubmit={submit} className="card p-4 md:p-6 space-y-4">
        <div>
          <label className="label">Seed keyword</label>
          <input className="input text-lg" value={seed} onChange={e => setSeed(e.target.value)} placeholder="concrete remover" autoFocus />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Marketplace</label>
            <select className="select" disabled>
              <option>Amazon US</option>
            </select>
          </div>
          <div>
            <label className="label">Scan depth</label>
            <select className="select" value={depth} onChange={e => setDepth(e.target.value as any)}>
              <option value="quick">Quick (top 10)</option>
              <option value="standard">Standard (top 20)</option>
              <option value="deep">Deep (top 40)</option>
            </select>
          </div>
          <div>
            <label className="label">Min monthly search volume</label>
            <input className="input" type="number" min={0} value={minVol} onChange={e => setMinVol(e.target.value)} placeholder="e.g. 500" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Max top-10 avg reviews</label>
            <input className="input" type="number" min={0} value={maxReviews} onChange={e => setMaxReviews(e.target.value)} placeholder="e.g. 2000" />
          </div>
          <div>
            <label className="label">Include keywords</label>
            <input className="input" value={include} onChange={e => setInclude(e.target.value)} placeholder="commercial, industrial" />
          </div>
          <div>
            <label className="label">Exclude keywords</label>
            <input className="input" value={exclude} onChange={e => setExclude(e.target.value)} placeholder="diy, cheap" />
          </div>
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why scanning this?" />
        </div>

        {err && <div className="text-xs text-[var(--red)] p-2 rounded-md bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)]">{err}</div>}

        <div className="flex items-center gap-2">
          <button className="btn btn-primary" disabled={running}>
            {running ? (<><Zap size={16} /> Running scan…</>) : (<><Zap size={16} /> Run scan</>)}
          </button>
          {running && <span className="text-xs text-[var(--text-muted)]">This may take 15–60 seconds.</span>}
        </div>
      </form>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Preset seed groups</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRESETS.map(p => (
            <div key={p.label} className="card p-3">
              <div className="font-medium text-sm mb-2">{p.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {p.keywords.map(k => (
                  <button key={k} type="button" onClick={() => setSeed(k)}
                    className="pill pill-new" style={{ cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
