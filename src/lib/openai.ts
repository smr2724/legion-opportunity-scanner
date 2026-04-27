import OpenAI from "openai";

export function isOpenAIConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

export async function testOpenAI() {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "OPENAI_API_KEY missing" };
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.models.list();
    return { ok: true, models_count: r.data.length };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export interface MemoInput {
  seedKeyword: string;
  topKeywords: { keyword: string; search_volume: number | null }[];
  topProducts: { title?: string; brand?: string; price?: number; rating?: number; review_count?: number; asin?: string }[];
  scores: {
    legion_score: number;
    demand_score: number;
    competition_weakness_score: number;
    product_advantage_score: number;
    visual_demo_score: number;
    economics_score: number;
    partner_score: number;
    recommended_path: string;
  };
  metrics: {
    monthly_search_volume: number;
    total_cluster_search_volume: number;
    top_10_avg_reviews: number;
    top_10_avg_rating: number;
    avg_price: number;
  };
}

export interface MemoOutput {
  summary: string;
  why_excited: string;
  why_skeptical: string;
  product_advantage_hypothesis: string;
  visual_demo_notes: string;
  economics_notes: string;
  partner_notes: string;
  recommended_path: "partner" | "launch" | "acquire" | "avoid";
}

const SYSTEM_PROMPT = `You are a senior Amazon category analyst advising Steve Rolle, an operator with deep experience in specialty chemicals, hospitality manufacturing, wholesale distribution, and Amazon private-label launches. You understand the "Legion Chemicals" case study: Legion took concrete remover from $0 to ~$100k/mo on Amazon in under a year by entering an ignored, boring, industrial category where demand existed, competition was weak, no clear winner owned page one, and product efficacy mattered.

Your job is to evaluate new Amazon category candidates with the SAME mental model. You are SKEPTICAL and OPERATOR-LEVEL, not hypey. Honest when data is weak. You never oversell.

Return JSON with exact keys: summary, why_excited, why_skeptical, product_advantage_hypothesis, visual_demo_notes, economics_notes, partner_notes, recommended_path.

- recommended_path must be one of: partner, launch, acquire, avoid.
- Each text field should be 2-5 sentences, sharp and concrete. No filler.
- Cite specific numbers from the input (search volume, avg reviews, avg rating, avg price, top brands) when making claims.
- "why_skeptical" is NOT optional — always identify at least one real trap or reason this might not work.`;

export async function generateMemo(input: MemoInput): Promise<MemoOutput> {
  if (!process.env.OPENAI_API_KEY) return placeholderMemo(input);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userMessage = JSON.stringify({
    seed_keyword: input.seedKeyword,
    top_keywords: input.topKeywords.slice(0, 15),
    top_products: input.topProducts.slice(0, 10).map(p => ({
      title: (p.title ?? "").slice(0, 120),
      brand: p.brand,
      price: p.price,
      rating: p.rating,
      review_count: p.review_count,
      asin: p.asin,
    })),
    scores: input.scores,
    metrics: input.metrics,
  }, null, 2);

  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Evaluate this Amazon category opportunity. Input data:\n\n${userMessage}\n\nReturn JSON with keys: summary, why_excited, why_skeptical, product_advantage_hypothesis, visual_demo_notes, economics_notes, partner_notes, recommended_path.` },
      ],
    });
    const text = resp.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    return normalizeMemo(parsed, input);
  } catch (e) {
    return placeholderMemo(input);
  }
}

function normalizeMemo(raw: any, input: MemoInput): MemoOutput {
  const path = (raw?.recommended_path ?? input.scores.recommended_path ?? "launch").toLowerCase();
  const valid = ["partner", "launch", "acquire", "avoid"].includes(path) ? path : "launch";
  return {
    summary: raw?.summary ?? "",
    why_excited: raw?.why_excited ?? "",
    why_skeptical: raw?.why_skeptical ?? "",
    product_advantage_hypothesis: raw?.product_advantage_hypothesis ?? "",
    visual_demo_notes: raw?.visual_demo_notes ?? "",
    economics_notes: raw?.economics_notes ?? "",
    partner_notes: raw?.partner_notes ?? "",
    recommended_path: valid as MemoOutput["recommended_path"],
  };
}

// =====================================================================
//  CRM: rank Apollo candidates and pick the 3 best contacts to enrich.
// =====================================================================

export interface RankInput {
  companyName: string;
  productContext: string;          // "Concrete remover, $1M+/yr Amazon channel"
  candidates: { id: string; name?: string; title?: string; seniority?: string; departments?: string[] }[];
}

export interface RankedPick {
  apollo_id: string;
  rank: number;          // 1, 2, 3
  reason: string;
}

const RANK_SYSTEM_PROMPT = `You are picking the 3 best people at a manufacturer for Steve Rolle to email about an Amazon partnership. Steve operates the Amazon channel for established manufacturers — he can buy wholesale, run the channel under their brand, or build a private label.

Target order of preference:
1. Owner / Founder / President / CEO at small to mid-size manufacturers (they make the call themselves).
2. VP Sales / Sales Director / Director of Business Development / Director of Channel.
3. VP / Director of E-commerce / Marketing / Digital — only if no clear sales leader exists.

Avoid: HR, IT, finance, individual sales reps without manager titles, support, interns, marketing coordinators.

Return JSON with exact key 'picks' = array of 3 objects: { apollo_id, rank (1-3), reason (one sentence, why they are the right person to email) }. Choose only from the candidates given. If fewer than 3 valid candidates exist, return as many as you can.`;

export async function rankContacts(input: RankInput): Promise<RankedPick[]> {
  if (!process.env.OPENAI_API_KEY) return heuristicRank(input.candidates);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: RANK_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Company: ${input.companyName}\nProduct context: ${input.productContext}\n\nCandidates:\n${JSON.stringify(input.candidates, null, 2)}`,
        },
      ],
    });
    const txt = resp.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(txt);
    const picks = Array.isArray(parsed?.picks) ? parsed.picks : [];
    return picks
      .filter((p: any) => p && typeof p.apollo_id === "string")
      .slice(0, 3)
      .map((p: any, i: number) => ({
        apollo_id: p.apollo_id,
        rank: Number(p.rank ?? i + 1),
        reason: String(p.reason ?? "").slice(0, 280),
      }));
  } catch {
    return heuristicRank(input.candidates);
  }
}

function heuristicRank(candidates: RankInput["candidates"]): RankedPick[] {
  // Fallback: simple keyword scoring when OpenAI is unavailable.
  const score = (t = "") => {
    const s = t.toLowerCase();
    if (/\b(owner|founder|president|ceo)\b/.test(s)) return 100;
    if (/\b(vp|vice president).*\b(sales|business)/.test(s)) return 90;
    if (/\b(director|head).*\b(sales|business)/.test(s)) return 85;
    if (/\bsales manager\b/.test(s)) return 70;
    if (/\b(vp|director|head).*\b(e-?commerce|ecommerce|digital)/.test(s)) return 65;
    if (/\bmarketing director\b/.test(s)) return 50;
    return 20;
  };
  return [...candidates]
    .map(c => ({ c, s: score(c.title) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(({ c }, i) => ({
      apollo_id: c.id,
      rank: i + 1,
      reason: `${c.title ?? "Contact"} — heuristic pick (configure OpenAI for AI reasoning).`,
    }));
}

// =====================================================================
//  CRM: draft outreach email per contact using product + supplier context.
// =====================================================================

export interface OutreachDraftInput {
  contactName: string;
  contactFirstName?: string;
  contactTitle?: string;
  companyName: string;
  productKeyword: string;        // "concrete remover"
  productCategory?: string;
  recommendedPath?: string;      // partner | private_label | wholesale_resell
  legionScore?: number;
  reviewBenchmark?: number;      // top-10 avg reviews
  monthlyVolume?: number;
}

export interface OutreachDraftOutput {
  subject: string;
  body: string;
}

const OUTREACH_SYSTEM_PROMPT = `You write short, plain, operator-to-operator outreach emails for Steve Rolle, founder of Rolle Management Group. Steve has done $60M+ in lifetime Amazon sales for established manufacturers (hospitality consumables grew $0 → ~$10M/yr; Legion Chemicals concrete remover $0 → $1M+ ARR in 10 months).

Tone: a manufacturer talking to another manufacturer. No agency-speak. No buzzwords. No flattery. Short sentences. Specific numbers when relevant. Lowercase subject line. 80-130 words body. End with a soft CTA — "Worth a 15-min call this week?" or similar.

Return JSON with exact keys: subject, body. Do NOT include greetings like "Dear Sir/Madam". Use first name if provided. Sign as "Steve Rolle / Rolle Management Group / steve@rollemanagementgroup.com".`;

export async function generateOutreachDraft(input: OutreachDraftInput): Promise<OutreachDraftOutput> {
  if (!process.env.OPENAI_API_KEY) return placeholderOutreach(input);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OUTREACH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write an outreach email for:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });
    const txt = resp.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(txt);
    return {
      subject: String(parsed.subject ?? `${input.productKeyword} on amazon — quick question`).slice(0, 200),
      body: String(parsed.body ?? placeholderOutreach(input).body),
    };
  } catch {
    return placeholderOutreach(input);
  }
}

function placeholderOutreach(input: OutreachDraftInput): OutreachDraftOutput {
  const first = input.contactFirstName ?? input.contactName.split(" ")[0] ?? "there";
  return {
    subject: `${input.productKeyword} on amazon — quick question`,
    body: `Hi ${first},\n\nI run Rolle Management Group — we operate the Amazon and marketplace channel for established manufacturers like ${input.companyName}. Lifetime, we've moved $60M+ across partner brands.\n\nI noticed your ${input.productKeyword} category and wanted to reach out. Most manufacturers I talk to either don't have anyone running Amazon as a real business, or have resellers chewing up the brand. We can either operate the channel under your brand (done-for-you), buy wholesale and run private label, or just be a clean authorized reseller.\n\nWorth a 15-minute call this week to see if there's a fit?\n\nSteve Rolle\nRolle Management Group\nsteve@rollemanagementgroup.com`,
  };
}

function placeholderMemo(input: MemoInput): MemoOutput {
  const { scores, metrics, seedKeyword } = input;
  return {
    summary: `${seedKeyword} scored ${scores.legion_score}/100. Monthly search volume ~${metrics.monthly_search_volume}, cluster ~${metrics.total_cluster_search_volume}. Top-10 avg ${metrics.top_10_avg_reviews} reviews at ${metrics.top_10_avg_rating} stars, avg price $${metrics.avg_price}. [Placeholder — configure OpenAI for full analyst memo.]`,
    why_excited: scores.competition_weakness_score >= 12
      ? `Page one looks beatable: top-10 avg review count (${metrics.top_10_avg_reviews}) is below typical winner thresholds and avg rating (${metrics.top_10_avg_rating}) suggests customer complaints. Demand score is ${scores.demand_score}/20.`
      : `Demand score is ${scores.demand_score}/20 and competition weakness is ${scores.competition_weakness_score}/20.`,
    why_skeptical: scores.competition_weakness_score < 10
      ? `Page one is already well-defended. Avg review count of ${metrics.top_10_avg_reviews} is a meaningful moat that will take real budget and time to breach.`
      : `Without product-efficacy data, product-advantage score (${scores.product_advantage_score}/20) is an assumption — validate with review mining before investing.`,
    product_advantage_hypothesis: `Hypothesis: a better-formulated, better-demonstrated, better-packaged ${seedKeyword} could win if current top-10 products have quality complaints. Manual review mining recommended.`,
    visual_demo_notes: scores.visual_demo_score >= 11
      ? `Strong before/after demo potential — customers see a problem solved in seconds. Ideal for short-form video, PDP carousel, and A+ content.`
      : `Visual demonstration is harder here — performance may be invisible or long-horizon. Content strategy will lean on trust signals rather than demos.`,
    economics_notes: `Avg price $${metrics.avg_price}. Economics score ${scores.economics_score}/15 assumes consumable/repeat potential and manageable shipping. Verify hazmat + carrier rules before launch.`,
    partner_notes: scores.partner_score >= 7
      ? `Category has traditional-distribution scent. Real manufacturers likely exist outside Amazon and underinvest in the channel. Good partner candidate.`
      : `Partner path is less obvious — either too commoditized or dominated by a few large brands. Launch or acquire more likely.`,
    recommended_path: (scores.recommended_path as any) ?? "launch",
  };
}
