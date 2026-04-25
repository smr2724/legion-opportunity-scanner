import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LegionScore, StatusPill, PathPill } from "@/components/ScorePills";
import { formatNumber, formatMoney, formatDate } from "@/lib/utils";
import DashboardFilters from "./DashboardFilters";

export const dynamic = "force-dynamic";

interface Search {
  status?: string;
  path?: string;
  min_score?: string;
  min_vol?: string;
  max_reviews?: string;
  category?: string;
  q?: string;
  sort?: string;
}

export default async function Dashboard({ searchParams }: { searchParams: Search }) {
  const supabase = createSupabaseServerClient();
  let q = supabase.from("opportunities").select("*");

  if (searchParams.status) q = q.eq("status", searchParams.status);
  if (searchParams.path) q = q.eq("recommended_path", searchParams.path);
  if (searchParams.category) q = q.eq("category", searchParams.category);
  if (searchParams.min_score) q = q.gte("legion_score", Number(searchParams.min_score));
  if (searchParams.min_vol) q = q.gte("monthly_search_volume", Number(searchParams.min_vol));
  if (searchParams.max_reviews) q = q.lte("top_10_avg_reviews", Number(searchParams.max_reviews));
  if (searchParams.q) q = q.ilike("main_keyword", `%${searchParams.q}%`);

  const sort = searchParams.sort ?? "score_desc";
  const orders: Record<string, { col: string; asc: boolean }> = {
    score_desc: { col: "legion_score", asc: false },
    score_asc: { col: "legion_score", asc: true },
    demand_desc: { col: "demand_score", asc: false },
    comp_desc: { col: "competition_weakness_score", asc: false },
    last_scanned: { col: "last_scanned_at", asc: false },
  };
  const o = orders[sort] ?? orders.score_desc;
  q = q.order(o.col, { ascending: o.asc, nullsFirst: false });

  const { data: opps } = await q.limit(500);

  // Category list for filters
  const { data: allOpps } = await supabase.from("opportunities").select("category, status").limit(1000);
  const categories = Array.from(new Set((allOpps ?? []).map(o => o.category).filter(Boolean))) as string[];

  const kpi = computeKpis(opps ?? []);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Opportunity Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Ranked by Legion Score. Every opportunity should end with a decision.</p>
        </div>
        <Link href="/scan" className="btn btn-primary">+ New Scan</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Kpi label="Total" value={kpi.total} />
        <Kpi label="Deep Dive" value={kpi.deep_dive} tone="green" />
        <Kpi label="Review" value={kpi.review} tone="yellow" />
        <Kpi label="Watchlist" value={kpi.watchlist} tone="orange" />
        <Kpi label="Avg Score" value={kpi.avg_score || "—"} />
      </div>

      <DashboardFilters categories={categories} initial={searchParams} />

      <div className="card overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1000px]">
            <thead>
              <tr>
                <th>Score</th>
                <th>Opportunity</th>
                <th>Category</th>
                <th className="numeric">Mo. Vol</th>
                <th className="numeric">Cluster Vol</th>
                <th className="numeric">Top10 Rev</th>
                <th className="numeric">Top10 Rate</th>
                <th className="numeric">Avg Price</th>
                <th>Path</th>
                <th>Status</th>
                <th>Scanned</th>
              </tr>
            </thead>
            <tbody>
              {(opps ?? []).map(o => (
                <tr key={o.id} className="cursor-pointer" onClick={undefined}>
                  <td>
                    <Link href={`/opportunities/${o.id}`}><LegionScore value={o.legion_score} size="md" /></Link>
                  </td>
                  <td>
                    <Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">
                      {o.name ?? o.main_keyword}
                    </Link>
                    <div className="text-xs text-[var(--text-muted)]">{o.main_keyword}</div>
                  </td>
                  <td><span className="text-xs text-[var(--text-muted)]">{o.category ?? "—"}</span></td>
                  <td className="numeric">{formatNumber(o.monthly_search_volume)}</td>
                  <td className="numeric">{formatNumber(o.total_cluster_search_volume)}</td>
                  <td className="numeric">{formatNumber(o.top_10_avg_reviews)}</td>
                  <td className="numeric">{o.top_10_avg_rating != null ? Number(o.top_10_avg_rating).toFixed(2) : "—"}</td>
                  <td className="numeric">{formatMoney(o.avg_price)}</td>
                  <td><PathPill value={o.recommended_path} /></td>
                  <td><StatusPill value={o.status} /></td>
                  <td className="text-xs text-[var(--text-muted)]">{formatDate(o.last_scanned_at ?? o.created_at)}</td>
                </tr>
              ))}
              {!opps?.length && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-[var(--text-muted)]">
                    No opportunities yet. <Link href="/scan" className="underline">Run your first scan</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: any; tone?: "green" | "yellow" | "orange" }) {
  const color = tone === "green" ? "#86efac" : tone === "yellow" ? "#fde047" : tone === "orange" ? "#fdba74" : "var(--text)";
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">{label}</div>
      <div className="text-xl md:text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function computeKpis(opps: any[]) {
  const total = opps.length;
  const byStatus = (s: string) => opps.filter(o => o.status === s).length;
  const scores = opps.map(o => Number(o.legion_score ?? 0)).filter(n => !isNaN(n));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return {
    total,
    deep_dive: byStatus("deep_dive"),
    review: byStatus("review"),
    watchlist: byStatus("watchlist"),
    avg_score: avg,
  };
}
