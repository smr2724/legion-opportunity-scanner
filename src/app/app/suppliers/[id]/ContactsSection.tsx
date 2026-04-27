"use client";

import { useState } from "react";
import { Search, Sparkles, Mail, ExternalLink, Link as LinkIcon, Loader2 } from "lucide-react";

interface Contact {
  id: string;
  full_name: string;
  title?: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  ai_priority_rank?: number;
  ai_priority_reason?: string;
  enriched_at?: string;
}

interface Candidate {
  id: string;
  name: string;
  title?: string;
  seniority?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
}

interface Thread {
  id?: string;
  contact_id: string;
  status?: string;
  subject?: string;
  outlook_web_link?: string;
  mailto_fallback?: string;
  outlook_ok?: boolean;
  outlook_error?: string;
  skipped?: boolean;
  reason?: string;
}

export default function ContactsSection({
  supplierId,
  initialContacts,
  initialThreads,
}: {
  supplierId: string;
  initialContacts: Contact[];
  initialThreads: { id: string; contact_id: string; status: string; subject?: string; outlook_web_link?: string }[];
}) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [candidateTotal, setCandidateTotal] = useState<number | null>(null);
  const [threads, setThreads] = useState<Thread[]>(initialThreads ?? []);
  const [loading, setLoading] = useState<"find" | "enrich" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setLoading("find"); setError(null);
    try {
      const r = await fetch("/api/contacts/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplierId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setCandidates(d.candidates);
      setCandidateTotal(d.total);
    } catch (e: any) {
      setError(String(e.message ?? e));
    } finally {
      setLoading(null);
    }
  }

  async function enrich() {
    if (!confirm("Enrich the top 3 contacts with Apollo? This consumes Apollo credits.")) return;
    setLoading("enrich"); setError(null);
    try {
      const r = await fetch("/api/contacts/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplierId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setContacts(d.contacts);
      setCandidates(null);
    } catch (e: any) {
      setError(String(e.message ?? e));
    } finally {
      setLoading(null);
    }
  }

  async function draft() {
    if (!confirm("Generate outreach drafts for the saved contacts? Creates real drafts in your Outlook (or mailto fallbacks).")) return;
    setLoading("draft"); setError(null);
    try {
      const r = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplierId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setThreads(d.threads);
    } catch (e: any) {
      setError(String(e.message ?? e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card p-4 md:p-5 mb-4">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Contacts &amp; Outreach</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Find the right people at this supplier, enrich the top 3, then draft personalized outreach to your Outlook.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn" onClick={find} disabled={loading !== null}>
            {loading === "find" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Find contacts
          </button>
          <button className="btn btn-primary" onClick={enrich} disabled={loading !== null}>
            {loading === "enrich" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Enrich top 3
          </button>
          <button className="btn" onClick={draft} disabled={loading !== null || !contacts.length}>
            {loading === "draft" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Draft outreach
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 mb-3 rounded border border-[var(--red)] text-[var(--red)] bg-[rgba(255,80,80,0.05)]">
          {error}
        </div>
      )}

      {/* Saved contacts (top-3 enriched) */}
      {contacts.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Top contacts ({contacts.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {contacts.map((c) => {
              const thread = threads.find(t => t.contact_id === c.id);
              return (
                <div key={c.id} className="rounded border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{c.full_name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{c.title ?? "—"}</div>
                    </div>
                    {c.ai_priority_rank ? (
                      <span className="pill pill-deep" style={{ fontSize: 10 }}>#{c.ai_priority_rank}</span>
                    ) : null}
                  </div>
                  {c.email && (
                    <div className="text-xs mt-2">
                      <a href={`mailto:${c.email}`} className="hover:underline break-all">{c.email}</a>
                      {c.email_status && (
                        <span className="ml-2 text-[var(--text-muted)]">· {c.email_status}</span>
                      )}
                    </div>
                  )}
                  {c.ai_priority_reason && (
                    <div className="text-[11px] text-[var(--text-muted)] mt-2 italic leading-snug">
                      “{c.ai_priority_reason}”
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    {c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:underline">
                        <LinkIcon size={12} /> LinkedIn
                      </a>
                    )}
                    {thread && (
                      <a
                        href={thread.outlook_web_link ?? thread.mailto_fallback ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--gold)] hover:underline ml-auto"
                      >
                        <ExternalLink size={12} /> Open draft
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidate preview (after Find) */}
      {candidates && (
        <div className="mb-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Apollo found {candidateTotal ?? candidates.length} people · showing first {candidates.length}
          </div>
          <div className="rounded border border-[var(--border)] overflow-hidden">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Title</th><th>Seniority</th><th>Location</th></tr>
              </thead>
              <tbody>
                {candidates.slice(0, 15).map(c => (
                  <tr key={c.id}>
                    <td>
                      {c.linkedin_url ? (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="hover:underline">{c.name || "—"}</a>
                      ) : (c.name || "—")}
                    </td>
                    <td className="text-xs">{c.title ?? "—"}</td>
                    <td className="text-xs text-[var(--text-muted)]">{c.seniority ?? "—"}</td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Click <strong>Enrich top 3</strong> to let AI pick the best three and unlock their emails.
          </p>
        </div>
      )}

      {!contacts.length && !candidates && !loading && (
        <div className="text-sm text-[var(--text-muted)] text-center py-6">
          No contacts yet. Click <strong className="text-[var(--text)]">Find contacts</strong> to search Apollo for people at this company.
        </div>
      )}
    </div>
  );
}
