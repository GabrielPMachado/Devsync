// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  demo: vi.fn(),
  deleteProject: vi.fn(),
  insertProject: vi.fn(),
  tags: vi.fn(),
  insertTags: vi.fn(),
  findLike: vi.fn(),
  insertLike: vi.fn(),
  deleteLike: vi.fn(),
  likesCount: vi.fn(),
  insertComment: vi.fn(),
  deleteComment: vi.fn(),
  updateProject: vi.fn(),
  rpc: vi.fn(),
};

const supabase = {
  rpc: (fn: string, args: unknown) => db.rpc(fn, args),
  from(table: string) {
    if (table === "projects")
      return {
        insert: (values: unknown) => ({ select: () => ({ single: () => db.insertProject(values) }) }),
        select: () => ({ eq: (_c: string, id: string) => ({ single: () => db.likesCount(id) }) }),
        delete: () => ({ eq: (_c: string, id: string) => db.deleteProject(id) }),
        update: (values: unknown) => ({ eq: (_c: string, id: string) => ({ select: () => ({ maybeSingle: () => db.updateProject(id, values) }) }) }),
      };
    if (table === "demos") return { select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: () => db.demo(id) }) }) };
    if (table === "tags") return { select: () => ({ in: (_c: string, slugs: string[]) => db.tags(slugs) }) };
    if (table === "project_tags") return { insert: (rows: unknown) => db.insertTags(rows) };
    if (table === "likes")
      return {
        select: () => ({ eq: (_c: string, pid: string) => ({ eq: (_c2: string, uid: string) => ({ maybeSingle: () => db.findLike(pid, uid) }) }) }),
        insert: (values: unknown) => db.insertLike(values),
        delete: () => ({ eq: (_c: string, pid: string) => ({ eq: (_c2: string, uid: string) => db.deleteLike(pid, uid) }) }),
      };
    if (table === "comments")
      return {
        insert: (values: unknown) => db.insertComment(values),
        delete: () => ({ eq: (_c: string, id: string) => db.deleteComment(id) }),
      };
    throw new Error(table);
  },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
const viewer = { id: "u1", email: "ana@x.dev", username: "ana", displayName: "Ana", avatarUrl: null };
const getViewer = vi.fn(async () => viewer as typeof viewer | null);
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const checkTone = vi.fn<(text: string) => Promise<{ flagged: boolean }>>(async () => ({ flagged: false }));
vi.mock("@/lib/moderation/tone", () => ({ checkTone: (text: string) => checkTone(text) }));

const cleanOrphanCovers = vi.fn(async () => {});
vi.mock("@/lib/projects/covers", async (orig) => ({
  ...(await orig<typeof import("@/lib/projects/covers")>()),
  cleanOrphanCovers: (...a: unknown[]) => cleanOrphanCovers(...(a as [])),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const { publishProject, updateProject, deleteProject, toggleLike, addComment, deleteComment } = await import("./actions");

const input = { title: "Kanban colaborativo", description: "Um quadro.", tags: ["react", "nextjs"], repoUrl: "https://github.com/a/b", siteUrl: "", demoId: "d1" };

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(viewer);
  checkTone.mockResolvedValue({ flagged: false });
  db.demo.mockResolvedValue({ data: { owner_id: "u1", status: "live" }, error: null });
  db.deleteProject.mockResolvedValue({ error: null });
  db.insertProject.mockResolvedValue({ data: { id: "p1", slug: "kanban-colaborativo-abc123" }, error: null });
  db.tags.mockImplementation(async (slugs: string[]) => ({ data: slugs.map((s) => ({ id: `id-${s}` })), error: null }));
  db.insertTags.mockResolvedValue({ error: null });
  db.findLike.mockResolvedValue({ data: null, error: null });
  db.insertLike.mockResolvedValue({ error: null });
  db.deleteLike.mockResolvedValue({ error: null });
  db.likesCount.mockResolvedValue({ data: { likes_count: 1 }, error: null });
  db.insertComment.mockResolvedValue({ error: null });
  db.deleteComment.mockResolvedValue({ error: null });
  db.updateProject.mockResolvedValue({ data: { slug: "kanban-colaborativo-abc123" }, error: null });
  db.rpc.mockResolvedValue({ error: null });
});

describe("publishProject", () => {
  it("dados inválidos voltam sem tocar no banco", async () => {
    await expect(publishProject({ ...input, title: "ab" })).resolves.toEqual({ error: "invalid", errors: { title: "length" } });
    expect(db.insertProject).not.toHaveBeenCalled();
  });

  it("cria o projeto com a demo, marca as tags e abre a página", async () => {
    await expect(publishProject(input)).rejects.toThrow("REDIRECT /projetos/kanban-colaborativo-abc123?publicado=1");
    expect(db.insertProject).toHaveBeenCalledWith({
      title: "Kanban colaborativo",
      description_md: "Um quadro.",
      repo_url: "https://github.com/a/b",
      site_url: null,
      demo_id: "d1",
    });
    expect(db.insertTags).toHaveBeenCalledWith([
      { project_id: "p1", tag_id: "id-react" },
      { project_id: "p1", tag_id: "id-nextjs" },
    ]);
  });

  it("demo de outra pessoa, ainda validando ou recusada não publica", async () => {
    for (const demo of [{ owner_id: "u2", status: "live" }, { owner_id: "u1", status: "pending" }, { owner_id: "u1", status: "unavailable" }, null]) {
      db.demo.mockResolvedValue({ data: demo, error: null });
      await expect(publishProject(input)).resolves.toEqual({ error: "demo" });
    }
    expect(db.insertProject).not.toHaveBeenCalled();
  });

  it("tag que não existe não publica", async () => {
    db.tags.mockResolvedValue({ data: [{ id: "id-react" }], error: null });
    await expect(publishProject(input)).resolves.toEqual({ error: "invalid", errors: { tags: "min" } });
    expect(db.insertProject).not.toHaveBeenCalled();
  });

  it("falha ao marcar as tags desfaz o projeto", async () => {
    db.insertTags.mockResolvedValue({ error: { code: "DS003" } });
    await expect(publishProject(input)).resolves.toEqual({ error: "unknown" });
    expect(db.deleteProject).toHaveBeenCalledWith("p1");
  });

  it("publica com a capa enviada", async () => {
    const coverUrl = "https://x.supabase.co/storage/v1/object/public/project-covers/u1/cover-1.webp?v=1";
    await expect(publishProject({ ...input, coverUrl })).rejects.toThrow("REDIRECT");
    expect(db.insertProject).toHaveBeenCalledWith(expect.objectContaining({ cover_url: coverUrl }));
  });

  it("capa de outro servidor ou de outra pessoa nem chega ao banco", async () => {
    for (const coverUrl of ["https://evil.example/storage/v1/object/public/project-covers/u1/cover-1.webp", "https://x.supabase.co/storage/v1/object/public/project-covers/u2/cover-1.webp"]) {
      await expect(publishProject({ ...input, coverUrl })).resolves.toEqual({ error: "cover" });
    }
    expect(db.insertProject).not.toHaveBeenCalled();
  });

  it("capa recusada pelo gatilho do banco volta como erro da capa", async () => {
    db.insertProject.mockResolvedValue({ data: null, error: { code: "22023", message: "a capa precisa estar na sua pasta do Storage" } });
    await expect(publishProject({ ...input, coverUrl: "https://x.supabase.co/storage/v1/object/public/project-covers/u1/cover-1.webp" })).resolves.toEqual({ error: "cover" });
  });

  it("sem login vai para /entrar", async () => {
    getViewer.mockResolvedValue(null);
    await expect(publishProject(input)).rejects.toThrow("REDIRECT /entrar?next=%2Fprojetos%2Fnovo");
  });
});

describe("toggleLike", () => {
  it("sem login vai para /entrar voltando à página", async () => {
    getViewer.mockResolvedValue(null);
    await expect(toggleLike("p1", "/projetos/x")).rejects.toThrow("REDIRECT /entrar?next=%2Fprojetos%2Fx");
  });

  it("curte quando ainda não curtiu", async () => {
    await expect(toggleLike("p1", "/projetos/x")).resolves.toEqual({ liked: true, count: 1 });
    expect(db.insertLike).toHaveBeenCalledWith({ project_id: "p1" });
  });

  it("banco recusando a curtida vira erro (o botão volta)", async () => {
    db.insertLike.mockResolvedValue({ error: { code: "42501" } });
    await expect(toggleLike("p1", "/projetos/x")).rejects.toThrow();
  });

  it("caminho fora das páginas de projeto não é usado", async () => {
    getViewer.mockResolvedValue(null);
    await expect(toggleLike("p1", "//mal.com")).rejects.toThrow("REDIRECT /entrar?next=%2Fprojetos");
  });

  it("descurte quando já curtiu", async () => {
    db.findLike.mockResolvedValue({ data: { project_id: "p1" }, error: null });
    db.likesCount.mockResolvedValue({ data: { likes_count: 0 }, error: null });
    await expect(toggleLike("p1", "/projetos/x")).resolves.toEqual({ liked: false, count: 0 });
    expect(db.deleteLike).toHaveBeenCalledWith("p1", "u1");
  });
});

describe("comentários", () => {
  it("vazio ou longo demais não vai para o banco", async () => {
    await expect(addComment("p1", "   ", null, "/projetos/x")).resolves.toEqual({ error: "empty" });
    await expect(addComment("p1", "a".repeat(5001), null, "/projetos/x")).resolves.toEqual({ error: "tooLong" });
    expect(db.insertComment).not.toHaveBeenCalled();
  });

  it("comenta e responde", async () => {
    await expect(addComment("p1", " Ficou ótimo! ", "c1", "/projetos/x")).resolves.toEqual({});
    expect(db.insertComment).toHaveBeenCalledWith({ target_type: "project", target_id: "p1", parent_id: "c1", body_md: "Ficou ótimo!" });
  });

  it("comentário ríspido volta com aviso; confirmado, publica", async () => {
    checkTone.mockResolvedValue({ flagged: true });
    await expect(addComment("p1", "que lixo", null, "/projetos/x")).resolves.toEqual({ toneWarning: true });
    expect(db.insertComment).not.toHaveBeenCalled();
    await expect(addComment("p1", "que lixo", null, "/projetos/x", true)).resolves.toEqual({});
    expect(db.insertComment).toHaveBeenCalledTimes(1);
    expect(checkTone).toHaveBeenCalledTimes(1);
  });

  it("apaga o próprio comentário", async () => {
    await expect(deleteComment("c1", "/projetos/x")).resolves.toEqual({});
    expect(db.deleteComment).toHaveBeenCalledWith("c1");
  });
});

const edit = { title: input.title, description: input.description, tags: input.tags, repoUrl: input.repoUrl, siteUrl: input.siteUrl };

describe("updateProject", () => {
  it("dados inválidos voltam sem tocar no banco", async () => {
    await expect(updateProject("p1", { ...edit, tags: [] })).resolves.toEqual({ error: "invalid", errors: { tags: "min" } });
    expect(db.updateProject).not.toHaveBeenCalled();
  });

  it("salva textos e links, troca as tags e volta para a página do projeto", async () => {
    await expect(updateProject("p1", { ...edit, siteUrl: " https://kanban.dev " })).rejects.toThrow("REDIRECT /projetos/kanban-colaborativo-abc123?editado=1");
    expect(db.updateProject).toHaveBeenCalledWith("p1", {
      title: "Kanban colaborativo",
      description_md: "Um quadro.",
      repo_url: "https://github.com/a/b",
      site_url: "https://kanban.dev",
    });
    expect(db.rpc).toHaveBeenCalledWith("set_project_tags", { project_id: "p1", tag_slugs: ["react", "nextjs"] });
    expect(cleanOrphanCovers).not.toHaveBeenCalled();
  });

  it("troca ou remove a capa e limpa as capas que sobraram", async () => {
    const coverUrl = "https://x.supabase.co/storage/v1/object/public/project-covers/u1/cover-2.webp?v=2";
    await expect(updateProject("p1", { ...edit, coverUrl })).rejects.toThrow("REDIRECT");
    expect(db.updateProject).toHaveBeenCalledWith("p1", expect.objectContaining({ cover_url: coverUrl }));
    expect(cleanOrphanCovers).toHaveBeenCalledWith(supabase, "u1");
    await expect(updateProject("p1", { ...edit, coverUrl: "" })).rejects.toThrow("REDIRECT");
    expect(db.updateProject).toHaveBeenLastCalledWith("p1", expect.objectContaining({ cover_url: null }));
  });

  it("capa de outro servidor nem chega ao banco", async () => {
    await expect(updateProject("p1", { ...edit, coverUrl: "https://evil.example/x.png" })).resolves.toEqual({ error: "cover" });
    expect(db.updateProject).not.toHaveBeenCalled();
  });

  it("projeto de outra pessoa (a RLS não devolve nada) não é editado", async () => {
    db.updateProject.mockResolvedValue({ data: null, error: null });
    await expect(updateProject("p1", edit)).resolves.toEqual({ error: "notFound" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("tag recusada pelo banco volta como erro das tags", async () => {
    db.rpc.mockResolvedValue({ error: { code: "22023" } });
    await expect(updateProject("p1", edit)).resolves.toEqual({ error: "invalid", errors: { tags: "min" } });
    db.rpc.mockResolvedValue({ error: { code: "DS003" } });
    await expect(updateProject("p1", edit)).resolves.toEqual({ error: "invalid", errors: { tags: "max" } });
  });

  it("sem login vai para /entrar", async () => {
    getViewer.mockResolvedValue(null);
    await expect(updateProject("p1", edit)).rejects.toThrow("REDIRECT /entrar?next=%2Fprojetos");
  });
});

describe("deleteProject", () => {
  it("exclui e volta para a lista de projetos", async () => {
    db.deleteProject.mockResolvedValue({ error: null, count: 1 });
    await expect(deleteProject("p1")).rejects.toThrow("REDIRECT /projetos?excluido=1");
    expect(db.deleteProject).toHaveBeenCalledWith("p1");
    expect(cleanOrphanCovers).toHaveBeenCalledWith(supabase, "u1");
  });

  it("nada apagado (projeto de outra pessoa ou já excluído) é erro", async () => {
    db.deleteProject.mockResolvedValue({ error: null, count: 0 });
    await expect(deleteProject("p1")).resolves.toEqual({ error: "notFound" });
  });

  it("erro do banco não redireciona", async () => {
    db.deleteProject.mockResolvedValue({ error: { code: "500" }, count: null });
    await expect(deleteProject("p1")).resolves.toEqual({ error: "unknown" });
  });

  it("sem login vai para /entrar", async () => {
    getViewer.mockResolvedValue(null);
    await expect(deleteProject("p1")).rejects.toThrow("REDIRECT /entrar?next=%2Fprojetos");
  });
});
