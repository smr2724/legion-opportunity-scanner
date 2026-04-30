import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateOutreachDraft } from "@/lib/openai";
import { createOutlookDraft } from "@/lib/outlook";

/**
 * POST /api/outreach/draft
 * Body: { supplier_id: string, contact_ids?: string[] }
 *
 * For each contact (or all top-3 if no contact_ids given):
 *  1) Generate subject+body with OpenAI using product context
 *  2) Create a real draft in Steve's Outlook (if OUTLOOK_ACCESS_TOKEN configured)
 *  3) Save an `outreach_threads` row with status='draft' linking to the draft
 *
 * Returns the threads (with mailto: fallback links if Outlook isn't configured).
 */
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supplier_id, contact_ids } = await req.json().catch(() => ({}));
  if (!supplier_id) return NextResponse.json({ error: "supplier_id required" }, { status: 400 });

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, company_name, sells_on_amazon")
    .eq("id", supplier_id)
    .eq("user_id", user.id)
    .single();
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  // Best opportunity for context
  const { data: pair } = await supabase
    .from("opportunity_suppliers")
    .select("opportunity_id, recommended_path, opportunities ( id, name, main_keyword, category, legion_score, top_10_avg_reviews, monthly_search_volume )")
    .eq("supplier_id", supplier_id)
    .order("supplier_score", { ascending: false })
    .limit(1)
    .maybeSingle();

  const opp: any = pair?.opportunities ?? null;

  // Pull contacts
  let contactQ = supabase
    .from("contacts")
    .select("*")
    .eq("supplier_id", supplier_id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (Array.isArray(contact_ids) && contact_ids.length) {
    contactQ = contactQ.in("id", contact_ids);
  } else {
    contactQ = contactQ.order("ai_priority_rank", { ascending: true }).limit(3);
  }
  const { data: contacts } = await contactQ;
  if (!contacts?.length) {
    return NextResponse.json({ error: "No contacts to draft to" }, { status: 400 });
  }

  const threads: any[] = [];

  for (const c of contacts) {
    if (!c.email) {
      // Skip contacts without email — record a stub so Steve can see the gap
      threads.push({ contact_id: c.id, skipped: true, reason: "No email on file" });
      continue;
    }

    const draft = await generateOutreachDraft({
      contactName: c.full_name,
      contactFirstName: c.first_name ?? undefined,
      contactTitle: c.title ?? undefined,
      companyName: supplier.company_name ?? "your company",
      // Critical: tell the model whether THIS supplier is on Amazon. If null/false, the pitch frames
      // category metrics as competitor activity, not the supplier's sales.
      supplierSellsOnAmazon: supplier.sells_on_amazon ?? null,
      productKeyword: opp?.main_keyword ?? opp?.name ?? "your product category",
      productCategory: opp?.category ?? undefined,
      recommendedPath: pair?.recommended_path ?? undefined,
      legionScore: opp?.legion_score ?? undefined,
      // These are CATEGORY-level metrics describing competitor activity — not the supplier's numbers.
      categoryTop10AvgReviews: opp?.top_10_avg_reviews ?? undefined,
      categoryMonthlyVolume: opp?.monthly_search_volume ?? undefined,
    });

    const ol = await createOutlookDraft({
      toEmail: c.email,
      toName: c.full_name,
      subject: draft.subject,
      body: draft.body,
    });

    const { data: thread } = await supabase
      .from("outreach_threads")
      .insert({
        user_id: user.id,
        contact_id: c.id,
        supplier_id: supplier.id,
        opportunity_id: opp?.id ?? null,
        status: "draft",
        subject: draft.subject,
        body: draft.body,
        outlook_draft_id: ol.outlookDraftId ?? null,
        outlook_web_link: ol.webLink ?? null,
      })
      .select()
      .single();

    threads.push({
      ...thread,
      mailto_fallback: ol.mailtoFallback,
      outlook_ok: ol.ok,
      outlook_error: ol.error,
    });
  }

  return NextResponse.json({ threads });
}
