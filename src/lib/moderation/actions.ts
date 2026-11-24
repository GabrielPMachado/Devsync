"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { buildReason, isReportTarget, normalizeDomain, type ReportTarget } from "./rules";

/**
 * Denúncias (qualquer membro) e ações do /admin. O banco é a barreira real:
 * a RLS de reports e as RPCs admin_* conferem quem pode o quê. Aqui só
 * validamos para dar mensagens boas.
 */

export type ReportResult = { ok: true } | { error: "signIn" | "reason" | "details" | "tooLong" | "already" | "unknown" };

export async function reportContent(target: string, targetId: string, reasonKey: string, details: string): Promise<ReportResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: "signIn" };
  if (!isReportTarget(target) || !targetId) return { error: "unknown" };
  const t = await getTranslations("Report");
  const built = buildReason(reasonKey, details, (k) => t(`reasons.${k}`));
  if (!built.ok) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({ target_type: target, target_id: targetId, reason: built.reason });
  if (error) return { error: error.code === "23505" ? "already" : "unknown" };
  return { ok: true };
}

export type AdminResult = { ok: true } | { error: "forbidden" | "invalid" | "notFound" | "unknown" };

export type ModerationAction = "hide" | "unhide" | "blockDemo" | "unblockDemo" | "suspendAuthor" | "unsuspendAuthor" | "dismiss";

type Client = Awaited<ReturnType<typeof createClient>>;

async function adminClient(): Promise<Client | null> {
  const viewer = await getViewer();
  return viewer?.isAdmin ? createClient() : null;
}

const HIDEABLE: ReportTarget[] = ["project", "question", "answer", "comment"];

/** Ação sobre o alvo e, quando é uma punição ou descarte, fecha as denúncias abertas dele. */
export async function moderate(input: { target: ReportTarget; targetId: string; action: ModerationAction; authorId?: string | null }): Promise<AdminResult> {
  const supabase = await adminClient();
  if (!supabase) return { error: "forbidden" };
  const { target, targetId, action, authorId } = input;
  if (!isReportTarget(target)) return { error: "unknown" };

  let call: [string, Record<string, unknown>] | null = null;
  let resolveAs: "actioned" | "dismissed" | null = "actioned";
  switch (action) {
    case "hide":
    case "unhide":
      if (!HIDEABLE.includes(target)) return { error: "unknown" };
      call = ["admin_set_hidden", { target, target_id: targetId, hidden: action === "hide" }];
      if (action === "unhide") resolveAs = null;
      break;
    case "blockDemo":
    case "unblockDemo":
      if (target !== "demo") return { error: "unknown" };
      call = ["admin_set_demo_status", { demo_id: targetId, status: action === "blockDemo" ? "blocked" : "live" }];
      if (action === "unblockDemo") resolveAs = null;
      break;
    case "suspendAuthor":
    case "unsuspendAuthor":
      if (!authorId) return { error: "unknown" };
      call = ["admin_suspend_profile", { profile_id: authorId, suspended: action === "suspendAuthor" }];
      if (action === "unsuspendAuthor") resolveAs = null;
      break;
    case "dismiss":
      resolveAs = "dismissed";
      break;
    default:
      return { error: "unknown" };
  }

  if (call) {
    const { error } = await supabase.rpc(call[0], call[1]);
    if (error) return { error: "unknown" };
  }
  if (resolveAs) {
    const { error } = await supabase.rpc("admin_resolve_target", { target, target_id: targetId, status: resolveAs });
    if (error) return { error: "unknown" };
  }
  revalidatePath("/admin");
  return { ok: true };
}

/** "Veja também": liga a pergunta repetida à original (endereço ou slug). */
export async function markDuplicate(questionId: string, original: string): Promise<AdminResult> {
  const supabase = await adminClient();
  if (!supabase) return { error: "forbidden" };
  const slug = original.trim().match(/(?:\/estudos\/)?([a-z0-9-]{1,160})(?:[?#].*)?$/)?.[1];
  if (!slug) return { error: "notFound" };
  const { data } = await supabase.from("questions").select("id").eq("slug", slug).maybeSingle();
  if (!data) return { error: "notFound" };
  if (data.id === questionId) return { error: "invalid" };
  const { error } = await supabase.rpc("admin_mark_duplicate", { question_id: questionId, original_id: data.id });
  if (error) return { error: "unknown" };
  await supabase.rpc("admin_resolve_target", { target: "question", target_id: questionId, status: "actioned" });
  revalidatePath("/admin");
  return { ok: true };
}

export async function blockDomain(domain: string, reason: string): Promise<AdminResult> {
  const supabase = await adminClient();
  if (!supabase) return { error: "forbidden" };
  const normalized = normalizeDomain(domain);
  if (!normalized) return { error: "invalid" };
  const { error } = await supabase.rpc("admin_block_domain", { domain: normalized, reason: reason.trim().slice(0, 500) });
  if (error) return { error: "unknown" };
  revalidatePath("/admin");
  return { ok: true };
}

export async function unblockDomain(domain: string): Promise<AdminResult> {
  const supabase = await adminClient();
  if (!supabase) return { error: "forbidden" };
  const { error } = await supabase.rpc("admin_unblock_domain", { domain });
  if (error) return { error: "unknown" };
  revalidatePath("/admin");
  return { ok: true };
}
