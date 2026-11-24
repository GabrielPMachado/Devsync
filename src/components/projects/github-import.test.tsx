import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { GithubError, type GithubRepo } from "@/lib/projects/github";
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

function setup(github: Partial<NonNullable<PublishServices["github"]>> = {}) {
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
      ...github,
    },
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
});
