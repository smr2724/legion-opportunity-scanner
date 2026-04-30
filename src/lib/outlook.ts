/**
 * Microsoft Outlook draft creation via Microsoft Graph.
 *
 * Auth: server env var `OUTLOOK_ACCESS_TOKEN` — a delegated Graph token for
 * Steve's mailbox (steve@rollemanagementgroup.com). Grab from Graph Explorer
 * (signed in with Mail.ReadWrite consent), paste into Vercel.
 *
 * Tokens expire in ~60–90 minutes. There is intentionally NO mailto fallback
 * — if the token is missing or expired, the UI surfaces a clear error so
 * Steve refreshes the token in Vercel rather than silently spawning the
 * macOS Mail app (which is what "mailto:" does on desktops).
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
  error?: string;
}

export async function createOutlookDraft(input: CreateDraftInput): Promise<CreateDraftResult> {
  const token = process.env.OUTLOOK_ACCESS_TOKEN;
  if (!token) {
    return {
      ok: false,
      error:
        "Outlook is not connected. Refresh OUTLOOK_ACCESS_TOKEN in Vercel (Graph Explorer → Mail.ReadWrite) and redeploy.",
    };
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
      const expired = r.status === 401 || /InvalidAuthenticationToken|expired|lifetime/i.test(text);
      return {
        ok: false,
        error: expired
          ? "Outlook access token expired. Refresh OUTLOOK_ACCESS_TOKEN in Vercel (Graph Explorer → Mail.ReadWrite) and redeploy."
          : `Graph ${r.status}: ${text.slice(0, 200)}`,
      };
    }
    const data = await r.json();
    return {
      ok: true,
      outlookDraftId: data.id,
      webLink: data.webLink,
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
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
