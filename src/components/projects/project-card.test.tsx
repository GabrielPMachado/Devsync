import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { ProjectCardData } from "@/lib/projects/queries";
import { ProjectCard } from "./project-card";

const base: ProjectCardData = {
  id: "p1",
  slug: "kanban-abc123",
  title: "Kanban colaborativo",
  description: "Quadro estilo Trello.",
  likesCount: 128,
  commentsCount: 24,
  createdAt: "2026-11-20T10:00:00Z",
  author: { username: "gabriel", displayName: "Gabriel Machado", avatarUrl: null },
  tags: ["nextjs", "supabase"],
  demo: { id: "d1", kind: "web_upload", status: "live", url: null, version: 1 },
};

function show(p: ProjectCardData) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ProjectCard project={p} basePath="/projetos" />
    </NextIntlClientProvider>,
  );
}

describe("ProjectCard", () => {
  it("demo ao vivo: selo e Ver demo abrindo a camada na mesma página", () => {
    show(base);
    expect(screen.getByText("Demo ao vivo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver demo de Kanban colaborativo" })).toHaveAttribute("href", "/projetos?demo=d1");
    expect(screen.getByRole("link", { name: "Kanban colaborativo" })).toHaveAttribute("href", "/projetos/kanban-abc123");
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(document.querySelector('[target="_blank"]')).toBeNull();
  });

  it("demo indisponível: selo, sem Ver demo", () => {
    show({ ...base, demo: { ...base.demo!, status: "unavailable" } });
    expect(screen.getByText("Indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver demo/ })).toBeNull();
  });

  it("capa própria aparece no topo do card", () => {
    show({ ...base, coverUrl: "https://x.supabase.co/capa.webp", demo: { ...base.demo!, screenshotUrl: "https://demos/p.jpg" } });
    expect(screen.getByRole("img", { name: "Capa de Kanban colaborativo" })).toHaveAttribute("src", "https://x.supabase.co/capa.webp");
  });

  it("sem capa, mostra o print da demo", () => {
    show({ ...base, coverUrl: null, demo: { ...base.demo!, screenshotUrl: "https://demos/p.jpg" } });
    expect(screen.getByRole("img", { name: "Capa de Kanban colaborativo" })).toHaveAttribute("src", "https://demos/p.jpg");
  });

  it("sem capa e sem print, fica o desenho padrão", () => {
    show({ ...base, coverUrl: null });
    expect(screen.queryByRole("img", { name: "Capa de Kanban colaborativo" })).toBeNull();
  });
});
