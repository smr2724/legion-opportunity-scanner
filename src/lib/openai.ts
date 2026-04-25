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
