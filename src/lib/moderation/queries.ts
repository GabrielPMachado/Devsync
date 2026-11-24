import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReportTarget } from "./rules";

export type QueueItem = {
  targetType: ReportTarget;
  targetId: string;
  reportCount: number;
  reasons: string[];
  firstReportedAt: string;
  lastReportedAt: string;
  resolvedAt: string | null;
  /** Só na aba Resolvidas: como foi fechada. */
  resolution: "actioned" | "dismissed" | null;
  title: string | null;
  preview: string | null;
  path: string | null;
  hidden: boolean;
  demoStatus: "pending" | "live" | "blocked" | "unavailable" | null;
  author: { id: string; username: string | null; suspended: boolean } | null;
};

type Row = {
  target_type: ReportTarget;
  target_id: string;
  report_count: number;
  reasons: string[];
  first_reported_at: string;
  last_reported_at: string;
  resolved_at: string | null;
  title: string | null;
  preview: string | null;
  path: string | null;
  hidden: boolean;
  demo_status: QueueItem["demoStatus"];
  author_id: string | null;
  author_username: string | null;
  author_suspended: boolean | null;
};

export function toQueueItem(r: Row, resolution: QueueItem["resolution"] = null): QueueItem {
  return {
    resolution,
    targetType: r.target_type,
    targetId: r.target_id,
    reportCount: r.report_count,
    reasons: r.reasons ?? [],
    firstReportedAt: r.first_reported_at,
    lastReportedAt: r.last_reported_at,
    resolvedAt: r.resolved_at,
    title: r.title,
    preview: r.preview,
    path: r.path,
    hidden: r.hidden,
    demoStatus: r.demo_status,
    author: r.author_id ? { id: r.author_id, username: r.author_username, suspended: !!r.author_suspended } : null,
  };
}

/** Fila do /admin. A RPC confere se quem chama é admin. */
export async function getQueue(status: "open" | "resolved"): Promise<QueueItem[]> {
  const supabase = await createClient();
  const statuses = status === "open" ? (["open"] as const) : (["actioned", "dismissed"] as const);
  const results = await Promise.all(statuses.map((s) => supabase.rpc("admin_report_queue", { p_status: s })));
  const rows = results.flatMap((r, i) => ((r.data ?? []) as Row[]).map((row) => toQueueItem(row, statuses[i] === "open" ? null : statuses[i])));
  if (status === "resolved") {
    rows.sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));
    return rows.slice(0, 50);
  }
  return rows;
}

export type BlockedDomain = { domain: string; reason: string | null; createdAt: string };

export async function getBlockedDomains(): Promise<BlockedDomain[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("blocked_domains").select("domain, reason, created_at").order("created_at", { ascending: false });
  return (data ?? []).map((d: { domain: string; reason: string | null; created_at: string }) => ({ domain: d.domain, reason: d.reason, createdAt: d.created_at }));
}
