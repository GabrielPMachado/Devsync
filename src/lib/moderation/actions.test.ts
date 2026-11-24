// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { insertReport: vi.fn(), rpc: vi.fn(), questionBySlug: vi.fn() };
const supabase = {
  from(table: string) {
    if (table === "reports") return { insert: (v: unknown) => db.insertReport(v) };
    if (table === "questions") return { select: () => ({ eq: (_c: string, slug: string) => ({ maybeSingle: () => db.questionBySlug(slug) }) }) };
    throw new Error(table);
  },
  rpc: (name: string, args: unknown) => db.rpc(name, args),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
const member = { id: "u1", email: "ana@x.dev", username: "ana", displayName: "Ana", avatarUrl: null, isAdmin: false };
const admin = { ...member, id: "adm", username: "gabriel", isAdmin: true };
const getViewer = vi.fn(async () => member as typeof member | null);
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => `[${key}]` }));

const { reportContent, moderate, markDuplicate, blockDomain, unblockDomain } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(member);
  db.insertReport.mockResolvedValue({ error: null });
  db.rpc.mockResolvedValue({ data: null, error: null });
  db.questionBySlug.mockResolvedValue({ data: { id: "q-original" }, error: null });
});

describe("reportContent", () => {
  it("grava a denúncia com o rótulo e os detalhes", async () => {
    await expect(reportContent("answer", "a1", "spam", " link ")).resolves.toEqual({ ok: true });
    expect(db.insertReport).toHaveBeenCalledWith({ target_type: "answer", target_id: "a1", reason: "[reasons.spam]: link" });
  });

  it("visitante precisa entrar", async () => {
    getViewer.mockResolvedValue(null);
    await expect(reportContent("answer", "a1", "spam", "")).resolves.toEqual({ error: "signIn" });
    expect(db.insertReport).not.toHaveBeenCalled();
  });

  it("valida alvo e motivo antes do banco", async () => {
    await expect(reportContent("tag", "a1", "spam", "")).resolves.toEqual({ error: "unknown" });
    await expect(reportContent("answer", "a1", "other", "")).resolves.toEqual({ error: "details" });
    expect(db.insertReport).not.toHaveBeenCalled();
  });

  it("denúncia repetida vira 'already'", async () => {
    db.insertReport.mockResolvedValue({ error: { code: "23505" } });
    await expect(reportContent("answer", "a1", "rude", "")).resolves.toEqual({ error: "already" });
  });

  it("outros erros viram 'unknown'", async () => {
    db.insertReport.mockResolvedValue({ error: { code: "42501" } });
    await expect(reportContent("answer", "a1", "rude", "")).resolves.toEqual({ error: "unknown" });
  });
});

describe("moderate", () => {
  it("só admin", async () => {
    await expect(moderate({ target: "answer", targetId: "a1", action: "hide" })).resolves.toEqual({ error: "forbidden" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("ocultar chama a RPC e fecha as denúncias como actioned", async () => {
    getViewer.mockResolvedValue(admin);
    await expect(moderate({ target: "answer", targetId: "a1", action: "hide" })).resolves.toEqual({ ok: true });
    expect(db.rpc).toHaveBeenNthCalledWith(1, "admin_set_hidden", { target: "answer", target_id: "a1", hidden: true });
    expect(db.rpc).toHaveBeenNthCalledWith(2, "admin_resolve_target", { target: "answer", target_id: "a1", status: "actioned" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("mostrar de novo não mexe nas denúncias", async () => {
    getViewer.mockResolvedValue(admin);
    await moderate({ target: "comment", targetId: "c1", action: "unhide" });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("admin_set_hidden", { target: "comment", target_id: "c1", hidden: false });
  });

  it("suspender demo e conta", async () => {
    getViewer.mockResolvedValue(admin);
    await moderate({ target: "demo", targetId: "d1", action: "blockDemo" });
    expect(db.rpc).toHaveBeenCalledWith("admin_set_demo_status", { demo_id: "d1", status: "blocked" });
    db.rpc.mockClear();
    await moderate({ target: "comment", targetId: "c1", action: "suspendAuthor", authorId: "u9" });
    expect(db.rpc).toHaveBeenNthCalledWith(1, "admin_suspend_profile", { profile_id: "u9", suspended: true });
    expect(db.rpc).toHaveBeenNthCalledWith(2, "admin_resolve_target", { target: "comment", target_id: "c1", status: "actioned" });
  });

  it("ocultar perfil ou demo não existe; suspender exige autor", async () => {
    getViewer.mockResolvedValue(admin);
    await expect(moderate({ target: "profile", targetId: "u9", action: "hide" })).resolves.toEqual({ error: "unknown" });
    await expect(moderate({ target: "comment", targetId: "c1", action: "suspendAuthor" })).resolves.toEqual({ error: "unknown" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("descartar fecha como dismissed", async () => {
    getViewer.mockResolvedValue(admin);
    await moderate({ target: "question", targetId: "q1", action: "dismiss" });
    expect(db.rpc).toHaveBeenCalledWith("admin_resolve_target", { target: "question", target_id: "q1", status: "dismissed" });
  });

  it("erro do banco vira 'unknown' e não fecha denúncias", async () => {
    getViewer.mockResolvedValue(admin);
    db.rpc.mockResolvedValueOnce({ error: { code: "42501" } });
    await expect(moderate({ target: "answer", targetId: "a1", action: "hide" })).resolves.toEqual({ error: "unknown" });
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("markDuplicate", () => {
  it("aceita endereço ou slug da original", async () => {
    getViewer.mockResolvedValue(admin);
    await expect(markDuplicate("q1", "https://devsync.app/estudos/como-centralizar-abc#x")).resolves.toEqual({ ok: true });
    expect(db.questionBySlug).toHaveBeenCalledWith("como-centralizar-abc");
    expect(db.rpc).toHaveBeenCalledWith("admin_mark_duplicate", { question_id: "q1", original_id: "q-original" });
    expect(db.rpc).toHaveBeenCalledWith("admin_resolve_target", { target: "question", target_id: "q1", status: "actioned" });
  });

  it("endereço com barra no fim", async () => {
    getViewer.mockResolvedValue(admin);
    await markDuplicate("q1", "/estudos/original-abc/");
    expect(db.questionBySlug).toHaveBeenCalledWith("original-abc");
  });

  it("original não encontrada", async () => {
    getViewer.mockResolvedValue(admin);
    db.questionBySlug.mockResolvedValue({ data: null, error: null });
    await expect(markDuplicate("q1", "nada")).resolves.toEqual({ error: "notFound" });
  });
});

describe("domínios", () => {
  it("bloqueia normalizado e desbloqueia", async () => {
    getViewer.mockResolvedValue(admin);
    await expect(blockDomain(" WWW.Golpe.dev ", "phishing")).resolves.toEqual({ ok: true });
    expect(db.rpc).toHaveBeenCalledWith("admin_block_domain", { domain: "golpe.dev", reason: "phishing" });
    await unblockDomain("golpe.dev");
    expect(db.rpc).toHaveBeenCalledWith("admin_unblock_domain", { domain: "golpe.dev" });
  });

  it("recusa domínio inválido", async () => {
    getViewer.mockResolvedValue(admin);
    await expect(blockDomain("localhost", "")).resolves.toEqual({ error: "invalid" });
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
