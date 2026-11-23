// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Supabase falso: cada chamada encadeada vira um registro em `calls`, e o
 * resultado vem de `results[`${tabela}.${operação}`]` (padrão: sem erro, sem dados).
 */
type Call = { table: string; op: string; payload?: unknown; filters: [string, string, unknown][] };
let calls: Call[] = [];
let results: Record<string, { data?: unknown; error?: unknown }> = {};

function chain(table: string, op: string, payload?: unknown) {
  const call: Call = { table, op, payload, filters: [] };
  calls.push(call);
  const result = () => Promise.resolve({ data: null, error: null, ...results[`${table}.${op}`] });
  const builder: Record<string, unknown> = {
    eq: (c: string, v: unknown) => (call.filters.push(["eq", c, v]), builder),
    in: (c: string, v: unknown) => (call.filters.push(["in", c, v]), builder),
    select: () => builder,
    single: result,
    maybeSingle: result,
    then: (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) => result().then(ok, fail),
  };
  return builder;
}

const supabase = {
  from: (table: string) => ({
    select: () => chain(table, "select"),
    insert: (p: unknown) => chain(table, "insert", p),
    update: (p: unknown) => chain(table, "update", p),
    delete: () => chain(table, "delete"),
  }),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
const member = { id: "u1", email: "ana@x.dev", username: "ana", displayName: "Ana", avatarUrl: null };
const getViewer = vi.fn(async () => member as typeof member | null);
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const actions = await import("./actions");

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

const goodQuestion = { title: "Como invalidar o cache de uma rota?", body: "Detalhes com `código`", tags: "nextjs, cache" };

beforeEach(() => {
  calls = [];
  results = {};
  refresh.mockClear();
  getViewer.mockResolvedValue(member);
});

describe("askQuestion", () => {
  it("visitante vai para /entrar e volta para o formulário", async () => {
    getViewer.mockResolvedValue(null);
    await expect(actions.askQuestion({}, form(goodQuestion))).rejects.toThrow("REDIRECT /entrar?next=%2Festudos%2Fperguntar");
  });

  it("erros de validação não tocam no banco", async () => {
    const state = await actions.askQuestion({}, form({ title: "curto", body: " ", tags: "" }));
    expect(state.errors).toEqual({ title: "short", body: "required", tags: "min" });
    expect(calls).toEqual([]);
  });

  it("grava a pergunta, cria tags que faltam e vai para a página dela", async () => {
    results["questions.insert"] = { data: { id: "q1", slug: "como-invalidar-abc123" } };
    results["tags.select"] = { data: [{ id: "t1", slug: "nextjs" }] };
    results["tags.insert"] = { data: [{ id: "t2", slug: "cache" }] };
    await expect(actions.askQuestion({}, form(goodQuestion))).rejects.toThrow("REDIRECT /estudos/como-invalidar-abc123");
    expect(calls.find((c) => c.table === "questions")?.payload).toEqual({ title: goodQuestion.title, body_md: goodQuestion.body });
    expect(calls.find((c) => c.table === "tags" && c.op === "insert")?.payload).toEqual([{ slug: "cache", name: "cache" }]);
    expect(calls.find((c) => c.table === "question_tags")?.payload).toEqual([
      { question_id: "q1", tag_id: "t1" },
      { question_id: "q1", tag_id: "t2" },
    ]);
  });

  it("se as tags falham, apaga a pergunta para não ficar órfã", async () => {
    results["questions.insert"] = { data: { id: "q1", slug: "x" } };
    results["tags.select"] = { data: [{ id: "t1", slug: "nextjs" }, { id: "t2", slug: "cache" }] };
    results["question_tags.insert"] = { error: { code: "42501" } };
    const state = await actions.askQuestion({}, form(goodQuestion));
    expect(state.errors).toEqual({ form: "unknown" });
    const del = calls.find((c) => c.table === "questions" && c.op === "delete");
    expect(del?.filters).toEqual([["eq", "id", "q1"]]);
  });
});

describe("postAnswer", () => {
  it("valida e grava com a versão da tecnologia", async () => {
    const state = await actions.postAnswer("q1", "slug", {}, form({ body: "Use revalidatePath", techVersion: " Next.js 16 " }));
    expect(state).toEqual({ ok: 1 });
    expect(calls[0]).toMatchObject({ table: "answers", op: "insert", payload: { question_id: "q1", body_md: "Use revalidatePath", tech_version: "Next.js 16" } });
    expect(refresh).toHaveBeenCalled();
  });

  it("resposta vazia não é gravada", async () => {
    const state = await actions.postAnswer("q1", "slug", {}, form({ body: "  ", techVersion: "" }));
    expect(state.errors).toEqual({ body: "required" });
    expect(calls).toEqual([]);
  });

  it("visitante volta para a pergunta depois de entrar", async () => {
    getViewer.mockResolvedValue(null);
    await expect(actions.postAnswer("q1", "minha-pergunta", {}, form({ body: "x" }))).rejects.toThrow(
      "REDIRECT /entrar?next=%2Festudos%2Fminha-pergunta",
    );
  });
});

describe("voteAnswer", () => {
  it("0 retira o voto", async () => {
    await actions.voteAnswer("a1", 0, "s");
    expect(calls).toEqual([{ table: "answer_votes", op: "delete", payload: undefined, filters: [["eq", "answer_id", "a1"], ["eq", "profile_id", "u1"]] }]);
  });

  it("troca o voto existente", async () => {
    results["answer_votes.update"] = { data: [{ answer_id: "a1" }] };
    await actions.voteAnswer("a1", -1, "s");
    expect(calls.map((c) => c.op)).toEqual(["update"]);
    expect(calls[0].payload).toEqual({ value: -1 });
  });

  it("sem voto anterior, cria um (só answer_id e value)", async () => {
    results["answer_votes.update"] = { data: [] };
    await actions.voteAnswer("a1", 1, "s");
    expect(calls.map((c) => c.op)).toEqual(["update", "insert"]);
    expect(calls[1].payload).toEqual({ answer_id: "a1", value: 1 });
  });
});

describe("marcações", () => {
  it("aceitar e desaceitar", async () => {
    await actions.acceptAnswer("q1", "a1", "s");
    await actions.acceptAnswer("q1", null, "s");
    expect(calls.map((c) => c.payload)).toEqual([{ accepted_answer_id: "a1" }, { accepted_answer_id: null }]);
  });

  it("não funciona mais e precisa de mais detalhes", async () => {
    await actions.toggleOutdated("a1", true, "s");
    await actions.toggleDetailRequest("q1", false, "s");
    expect(calls[0]).toMatchObject({ table: "outdated_flags", op: "insert", payload: { answer_id: "a1" } });
    expect(calls[1]).toMatchObject({ table: "detail_requests", op: "delete", filters: [["eq", "question_id", "q1"], ["eq", "profile_id", "u1"]] });
  });
});
