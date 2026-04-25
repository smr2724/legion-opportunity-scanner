import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { testDataForSEO, isDataForSEOConfigured } from "@/lib/dataforseo";
import { testKeepa, isKeepaConfigured } from "@/lib/keepa";
import { testOpenAI, isOpenAIConfigured } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const provider = String(body?.provider ?? "");

  let result: any = { ok: false, error: "unknown provider" };
  if (provider === "supabase") {
    const { data: u } = await supabase.auth.getUser();
    result = { ok: !!u.user, user_email: u.user?.email };
  } else if (provider === "dataforseo") {
    result = isDataForSEOConfigured() ? await testDataForSEO() : { ok: false, error: "not configured" };
  } else if (provider === "keepa") {
    result = isKeepaConfigured() ? await testKeepa() : { ok: false, error: "not configured" };
  } else if (provider === "openai") {
    result = isOpenAIConfigured() ? await testOpenAI() : { ok: false, error: "not configured" };
  }

  return NextResponse.json(result);
}

export async function GET() {
  // Summary for Settings page
  return NextResponse.json({
    configured: {
      dataforseo: isDataForSEOConfigured(),
      keepa: isKeepaConfigured(),
      openai: isOpenAIConfigured(),
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  });
}
