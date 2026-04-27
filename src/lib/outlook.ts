/**
 * Microsoft Outlook draft creation via Microsoft Graph.
 *
 * Two ways to authenticate:
 *   1. Server env var `OUTLOOK_ACCESS_TOKEN` — a delegated Graph token for
 *      Steve's mailbox (steve@rollemanagementgroup.com). Easiest for v1:
 *      grab from Graph Explorer or a small OAuth helper, paste into Vercel.
 *   2. Per-user OAuth flow (future) — store refresh tokens in Supabase and
 *      mint access tokens on demand.
 *
 * For v1 we ship #1 and gracefully degrade to a `mailto:` fallback when the
 * token isn't configured, so Steve can still review drafts in his email
 * client today.
 */
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export function isOutlookConfigured() {
  return !!process.env.OUTLOOK_ACCESS_TOKEN;
}

export interface CreateDraftInput {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;        // plain text or simple HTML
}

export interface CreateDraftResult {
  ok: boolean;
  outlookDraftId?: string;
  webLink?: string;
  mailtoFallback?: string;
  error?: string;
}

export async function createOutlookDraft(input: CreateDraftInput): Promise<CreateDraftResult> {
  // Always compute the mailto fallback so the UI has something to click.
  const mailto = buildMailto(input);

  const token = process.env.OUTLOOK_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, error: "OUTLOOK_ACCESS_TOKEN missing", mailtoFallback: mailto };
  }

  const payload = {
    subject: input.subject,
    body: {
      contentType: "Text",
      content: input.body,
    },
    toRecipients: [
      {
        emailAddress: {
          address: input.toEmail,
          ...(input.toName ? { name: input.toName } : {}),
        },
      },
    ],
    isDraft: true,
  };

  try {
    const r = await fetch(`${GRAPH_BASE}/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const text = await r.text();
      return {
        ok: false,
        error: `Graph ${r.status}: ${text.slice(0, 200)}`,
        mailtoFallback: mailto,
      };
    }
    const data = await r.json();
    return {
      ok: true,
      outlookDraftId: data.id,
      webLink: data.webLink,
      mailtoFallback: mailto,
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), mailtoFallback: mailto };
  }
}

function buildMailto(input: CreateDraftInput) {
  return (
    "mailto:" +
    encodeURIComponent(input.toEmail) +
    `?subject=${encodeURIComponent(input.subject)}` +
    `&body=${encodeURIComponent(input.body)}`
  );
}

export async function testOutlook(): Promise<{ ok: boolean; error?: string; user_email?: string }> {
  if (!process.env.OUTLOOK_ACCESS_TOKEN) return { ok: false, error: "OUTLOOK_ACCESS_TOKEN missing" };
  try {
    const r = await fetch(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${process.env.OUTLOOK_ACCESS_TOKEN}` },
    });
    if (!r.ok) return { ok: false, error: `Graph ${r.status}` };
    const d = await r.json();
    return { ok: true, user_email: d.mail ?? d.userPrincipalName };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
