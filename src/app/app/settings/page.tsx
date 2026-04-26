"use client";
import { useEffect, useState } from "react";
import { Check, X, RefreshCw } from "lucide-react";

type ProviderKey = "supabase" | "dataforseo" | "keepa" | "openai";

export default function SettingsPage() {
  const [configured, setConfigured] = useState<Record<ProviderKey, boolean>>({
    supabase: true, dataforseo: false, keepa: false, openai: false,
  });
  const [status, setStatus] = useState<Record<ProviderKey, any>>({
    supabase: null, dataforseo: null, keepa: null, openai: null,
  });
  const [loading, setLoading] = useState<Record<ProviderKey, boolean>>({
    supabase: false, dataforseo: false, keepa: false, openai: false,
  });

  useEffect(() => {
    fetch("/api/providers/test").then(r => r.json()).then(d => {
      if (d?.configured) setConfigured(d.configured);
    });
  }, []);

  async function test(provider: ProviderKey) {
    setLoading(l => ({ ...l, [provider]: true }));
    try {
      const r = await fetch("/api/providers/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const d = await r.json();
      setStatus(s => ({ ...s, [provider]: d }));
    } finally {
      setLoading(l => ({ ...l, [provider]: false }));
    }
  }

  const rows: { key: ProviderKey; name: string; desc: string }[] = [
    { key: "supabase", name: "Supabase", desc: "Auth, database, storage." },
    { key: "dataforseo", name: "DataForSEO", desc: "Amazon keyword volume + SERP / product data." },
    { key: "keepa", name: "Keepa", desc: "ASIN enrichment, BSR, price and review history." },
    { key: "openai", name: "OpenAI", desc: "Skeptical analyst memos." },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Settings — API Health</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Test each provider connection. Keys are stored as server env vars only — never sent to the browser.</p>
      </div>

      <div className="card divide-y divide-[var(--border-soft)]">
        {rows.map(r => {
          const s = status[r.key];
          const ok = s?.ok;
          const isConfigured = configured[r.key];
          return (
            <div key={r.key} className="p-4 flex flex-wrap gap-3 items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {isConfigured
                    ? <span className="pill pill-launch" style={{ fontSize: 10 }}>Configured</span>
                    : <span className="pill pill-reject" style={{ fontSize: 10 }}>Missing</span>}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{r.desc}</div>
                {s && (
                  <div className="mt-2 text-xs">
                    {ok ? (
                      <div className="flex items-center gap-1.5 text-[var(--green)]"><Check size={12} />
                        {r.key === "dataforseo" && s.money != null ? `Credits: $${s.money}` : null}
                        {r.key === "keepa" && s.tokens_left != null ? `Tokens: ${s.tokens_left}` : null}
                        {r.key === "openai" && s.models_count ? `${s.models_count} models available` : null}
                        {r.key === "supabase" && s.user_email ? `Signed in: ${s.user_email}` : null}
                        {!s.money && !s.tokens_left && !s.models_count && !s.user_email && "OK"}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[var(--red)]"><X size={12} /> {s.error ?? "Failed"}</div>
                    )}
                  </div>
                )}
              </div>
              <button className="btn" onClick={() => test(r.key)} disabled={loading[r.key]}>
                <RefreshCw size={14} className={loading[r.key] ? "animate-spin" : ""} />
                Test
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 card p-4 text-xs text-[var(--text-muted)] leading-relaxed">
        <strong className="text-[var(--text)]">Env vars expected (set in Vercel):</strong>
        <ul className="mt-2 space-y-1 font-mono">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>SUPABASE_SERVICE_ROLE_KEY (optional)</li>
          <li>DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD</li>
          <li>KEEPA_API_KEY</li>
          <li>KEEPA_DOMAIN_ID (default 1 = Amazon US)</li>
          <li>OPENAI_API_KEY</li>
        </ul>
      </div>
    </div>
  );
}
