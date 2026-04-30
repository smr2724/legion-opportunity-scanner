import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  fetchGraphMe,
  saveOauthToken,
} from "@/lib/microsoft-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth redirect target. Validates the state cookie, exchanges the auth code
 * for access + refresh tokens, fetches the user's email for display, persists
 * everything, and bounces back to /app/settings.
 */
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return redirectToSettings(req, {
      ms_status: "error",
      ms_error: errorDescription || error,
    });
  }

  if (!code) {
    return redirectToSettings(req, { ms_status: "error", ms_error: "Missing authorization code" });
  }

  // CSRF check
  const cookieState = req.cookies.get("ms_oauth_state")?.value;
  if (!cookieState || !state || cookieState !== state) {
    return redirectToSettings(req, {
      ms_status: "error",
      ms_error: "OAuth state mismatch — please try connecting again",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      origin: req.nextUrl.origin,
    });

    if (!tokens.refresh_token) {
      return redirectToSettings(req, {
        ms_status: "error",
        ms_error: "No refresh token returned. Make sure offline_access scope is granted.",
      });
    }

    const me = await fetchGraphMe(tokens.access_token);

    await saveOauthToken({
      userId: user.id,
      accountEmail: me.email ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope ?? null,
      expiresInSec: tokens.expires_in,
    });

    const res = redirectToSettings(req, { ms_status: "connected" });
    res.cookies.delete("ms_oauth_state");
    return res;
  } catch (e: any) {
    return redirectToSettings(req, {
      ms_status: "error",
      ms_error: String(e?.message ?? e).slice(0, 300),
    });
  }
}

function redirectToSettings(req: NextRequest, params: Record<string, string>) {
  const dest = new URL("/app/settings", req.url);
  for (const [k, v] of Object.entries(params)) {
    dest.searchParams.set(k, v);
  }
  return NextResponse.redirect(dest);
}
