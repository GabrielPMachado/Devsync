import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { GithubError, type GithubRepo } from "@/lib/projects/github";
import type { SiteLookup } from "@/lib/projects/github-demo";
import type { BuildRow } from "@/lib/demos/client";
import { PublishForm, type PublishServices } from "./publish-form";

const tags = [
  { slug: "react", name: "React" },
  { slug: "typescript", name: "TypeScript" },
];

const repo = (name: string, over: Partial<GithubRepo> = {}): GithubRepo => ({
  name,
  fullName: `ana/${name}`,
  description: `Sobre ${name}`,
  htmlUrl: `https://github.com/ana/${name}`,
  homepage: null,
  language: "TypeScript",
  topics: [],
  fork: false,
  pushedAt: "2026-11-20T00:00:00Z",
  defaultBranch: "main",
  ...over,
});

function setup(github: Partial<NonNullable<PublishServices["github"]>> = {}, extra: Partial<PublishServices> = {}) {
  const services = {
    base: new URL("http://demos.localhost:8787"),
    token: vi.fn(async () => "tok"),
    createUpload: vi.fn(),
    putZip: vi.fn(),
    completeUpload: vi.fn(),
    embedCheck: vi.fn(),
    verifyDemo: vi.fn(),
    readDemo: vi.fn(),
    createLinkDemo: vi.fn(),
    publish: vi.fn(),
    github: {
      user: "ana",
      listRepos: vi.fn(async () => [repo("kanban", { homepage: "https://kanban.ana.dev", topics: ["reactjs"] }), repo("blog")]),
      repoDetails: vi.fn(async () => ({ readme: "# Kanban", languages: ["TypeScript"] })),
      findSiteSource: vi.fn(async () => ({ kind: "found", source: { ref: "gh-pages", folder: "", files: [{ path: "index.html", size: 5 }, { path: "app.js", size: 5 }] } })),
      buildDemoZip: vi.fn(async () => new File([new Uint8Array(20)], "blog.zip", { type: "application/zip" })),
      ...github,
    },
    ...extra,
  } as unknown as PublishServices;
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      <PublishForm tags={tags} services={services} />
    </NextIntlClientProvider>,
  );
  return services;
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "Escolher repositório" }));

describe("Importar do GitHub", () => {
  it("lista os repositórios do usuário do perfil e preenche o formulário", async () => {
    const services = setup();
    open();
    const list = await screen.findByRole("list", { name: "Repositórios de ana" });
    expect(services.github!.listRepos).toHaveBeenCalledWith("ana");
    fireEvent.click(within(list).getByRole("button", { name: "Usar kanban" }));

    await screen.findByText("Importado de ana/kanban. Confira antes de publicar.");
    expect(screen.getByLabelText("Título")).toHaveValue("kanban");
    expect(screen.getByLabelText("Descrição")).toHaveValue("# Kanban");
    expect(screen.getByLabelText("react")).toBeChecked();
    expect(screen.getByLabelText("typescript")).toBeChecked();
    expect(screen.getByLabelText("Repositório")).toHaveValue("https://github.com/ana/kanban");
    expect(screen.getByLabelText("Site do projeto")).toHaveValue("https://kanban.ana.dev");
    expect(screen.getByLabelText("Link da demo")).toHaveValue("https://kanban.ana.dev");
    expect(screen.queryByRole("list", { name: "Repositórios de ana" })).not.toBeInTheDocument();
  });

  it("filtra a lista pelo nome", async () => {
    setup();
    open();
    await screen.findByRole("button", { name: "Usar blog" });
    fireEvent.change(screen.getByLabelText("Filtrar repositórios"), { target: { value: "kan" } });
    expect(screen.queryByRole("button", { name: "Usar blog" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar kanban" })).toBeInTheDocument();
  });

  it("sem usuário no perfil, pede o nome antes de buscar", async () => {
    const services = setup({ user: null });
    open();
    expect(services.github!.listRepos).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Usuário do GitHub"), { target: { value: "bia" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByRole("list", { name: "Repositórios de bia" });
    expect(services.github!.listRepos).toHaveBeenCalledWith("bia");
  });

  it("usuário sem repositórios públicos", async () => {
    setup({ listRepos: vi.fn(async () => []) });
    open();
    expect(await screen.findByText("Nenhum repositório público encontrado.")).toBeInTheDocument();
  });

  it("mostra os erros do GitHub sem travar o formulário", async () => {
    setup({ listRepos: vi.fn(async () => Promise.reject(new GithubError("rate_limit", new Date("2026-11-24T13:30:00Z")))) });
    open();
    expect(await screen.findByText("O GitHub limitou as buscas por agora. Tente de novo às 10:30.")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toBeEnabled();
  });

  it("usuário inexistente", async () => {
    setup({ listRepos: vi.fn(async () => Promise.reject(new GithubError("not_found"))) });
    open();
    expect(await screen.findByText("Não achamos esse usuário no GitHub.")).toBeInTheDocument();
  });

  it("falha ao ler o repositório escolhido", async () => {
    setup({ repoDetails: vi.fn(async () => Promise.reject(new GithubError("network"))) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    expect(await screen.findByText("Não deu para falar com o GitHub. Tente de novo.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveValue(""));
  });

  it("reimportar um repo sem site tira a demo do anterior", async () => {
    setup({ findSiteSource: vi.fn(async () => ({ kind: "none" }) as SiteLookup) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar kanban" }));
    await screen.findByText("Importado de ana/kanban. Confira antes de publicar.");
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    await screen.findByText("Importado de ana/blog. Confira antes de publicar.");
    expect(screen.getByLabelText("Link da demo")).toHaveValue("");
    expect(screen.getByLabelText("Site do projeto")).toHaveValue("");
  });

  it("busca antiga que volta depois não substitui a nova", async () => {
    let releaseOld: (v: GithubRepo[]) => void = () => {};
    const listRepos = vi.fn((u: string) => (u === "velho" ? new Promise<GithubRepo[]>((r) => (releaseOld = r)) : Promise.resolve([repo("novo")])));
    setup({ user: null, listRepos });
    open();
    const field = screen.getByLabelText("Usuário do GitHub");
    fireEvent.change(field, { target: { value: "velho" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.change(field, { target: { value: "novo" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await screen.findByRole("list", { name: "Repositórios de novo" });
    releaseOld([repo("antigo")]);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("list", { name: "Repositórios de novo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar antigo" })).not.toBeInTheDocument();
  });

  it("repo sem site publicado: os arquivos viram a demo enviada no publicar", async () => {
    const services = setup();
    (services.createUpload as ReturnType<typeof vi.fn>).mockResolvedValue({ demoId: "d1", uploadUrl: "http://u" });
    (services.putZip as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (services.completeUpload as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (services.readDemo as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "live", rejection_reason: null });
    (services.publish as ReturnType<typeof vi.fn>).mockResolvedValue({ error: "unknown" });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    expect(await screen.findByText("Arquivos do GitHub")).toBeInTheDocument();
    expect(screen.getByText("ana/blog · branch gh-pages · 2 arquivos")).toBeInTheDocument();
    expect(services.github!.findSiteSource).toHaveBeenCalledWith(expect.objectContaining({ fullName: "ana/blog" }));

    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    await waitFor(() => expect(services.publish).toHaveBeenCalled());
    expect(services.github!.buildDemoZip).toHaveBeenCalledWith(expect.objectContaining({ fullName: "ana/blog" }), expect.objectContaining({ ref: "gh-pages" }));
    expect(services.putZip).toHaveBeenCalledWith("http://u", expect.objectContaining({ name: "blog.zip" }));
  });

  it("repo com site publicado não procura arquivos", async () => {
    const services = setup();
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar kanban" }));
    await screen.findByText("Importado de ana/kanban. Confira antes de publicar.");
    expect(services.github!.findSiteSource).not.toHaveBeenCalled();
  });

  it.each<[SiteLookup["kind"], string]>([
    ["needs_build", "Esse repositório precisa ser compilado antes de virar demo."],
    ["none", "Não achamos um index.html no repositório"],
    ["too_big", "O site do repositório passa de 500 arquivos ou 60 MB."],
  ])("explica quando os arquivos não servem (%s)", async (kind, text) => {
    setup({ findSiteSource: vi.fn(async () => ({ kind }) as SiteLookup) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    expect(await screen.findByText(text, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Arquivos do GitHub")).not.toBeInTheDocument();
  });

  it("dá para trocar os arquivos do GitHub por um .zip", async () => {
    setup();
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enviar um .zip em vez disso" }));
    expect(screen.queryByText("Arquivos do GitHub")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Escolha o .zip do site.", { exact: false })).toBeInTheDocument();
  });

  it("falha ao procurar os arquivos não impede a importação", async () => {
    setup({ findSiteSource: vi.fn(async () => Promise.reject(new GithubError("network"))) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    await screen.findByText("Importado de ana/blog. Confira antes de publicar.");
    expect(screen.getByLabelText("Título")).toHaveValue("blog");
  });

  it("zip montado acima de 64 MB mostra o erro e volta para escolher um .zip", async () => {
    const big = new File([new Uint8Array(1)], "blog.zip", { type: "application/zip" });
    Object.defineProperty(big, "size", { value: 64 * 1024 * 1024 + 1 });
    const services = setup({ buildDemoZip: vi.fn(async () => big) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    await screen.findByText("Arquivos do GitHub");
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("O .zip passa de 64 MB.")).toBeInTheDocument();
    expect(screen.queryByText("Arquivos do GitHub")).not.toBeInTheDocument();
    expect(services.createUpload).not.toHaveBeenCalled();
  });
});

describe("build automático", () => {
  function setupBuild(rows: BuildRow[]) {
    const queue = [...rows];
    const services = setup(
      { findSiteSource: vi.fn(async () => ({ kind: "needs_build" }) as SiteLookup) },
      {
        startBuild: vi.fn(async () => ({ demoId: "d9", buildId: "b9" })),
        readBuild: vi.fn(async () => (queue.length > 1 ? queue.shift()! : queue[0]!)),
        sleep: async () => {},
      },
    );
    (services.publish as ReturnType<typeof vi.fn>).mockResolvedValue({ error: "unknown" });
    return services;
  }
  const row = (stage: BuildRow["stage"], extra: Partial<BuildRow> = {}): BuildRow => ({ stage, error: null, log: null, framework: "vite", ...extra });

  it("repo que precisa de build é compilado na nuvem e publicado", async () => {
    const services = setupBuild([row("queued"), row("installing"), row("building"), row("validating"), row("ready")]);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    expect(await screen.findByText("Compilado na nuvem")).toBeInTheDocument();
    expect(screen.getByText("ana/blog · branch main")).toBeInTheDocument();
    expect(screen.queryByText("Esse repositório precisa ser compilado", { exact: false })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    await waitFor(() => expect(services.publish).toHaveBeenCalledWith(expect.objectContaining({ demoId: "d9" })));
    expect(services.startBuild).toHaveBeenCalledWith(expect.objectContaining({ token: "tok" }), "ana/blog", "main");
    expect(services.readBuild).toHaveBeenCalledWith("b9");
    expect(screen.getByText("Instalando dependências")).toBeInTheDocument();
    expect(screen.getByText("Detectado: vite")).toBeInTheDocument();
  });

  it("build que falha mostra o motivo e o log, sem publicar", async () => {
    const services = setupBuild([row("building"), row("failed", { error: "build_failed", log: "error TS2304: Cannot find name 'x'" })]);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("O build não deu certo")).toBeInTheDocument();
    expect(screen.getByText("O build falhou. Veja o log abaixo.")).toBeInTheDocument();
    expect(screen.getByText("error TS2304: Cannot find name 'x'")).toBeInTheDocument();
    expect(services.publish).not.toHaveBeenCalled();
  });

  it("zip recusado na validação usa o motivo do serviço de demos", async () => {
    setupBuild([row("validating"), row("failed", { error: "no_index" })]);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Não achamos o index.html na raiz do .zip (nem numa única pasta).")).toBeInTheDocument();
  });

  it("dá para trocar o build por um .zip", async () => {
    setupBuild([row("ready")]);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Usar blog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enviar um .zip em vez disso" }));
    expect(screen.queryByText("Compilado na nuvem")).not.toBeInTheDocument();
  });
});
