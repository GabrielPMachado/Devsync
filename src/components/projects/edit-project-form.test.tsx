import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { EditProjectForm } from "./edit-project-form";

const tags = [
  { slug: "react", name: "React" },
  { slug: "nextjs", name: "Next.js" },
  { slug: "css", name: "CSS" },
];
const project = { id: "p1", slug: "kanban-abc123", title: "Kanban", description: "Um quadro.", tags: ["react"], repoUrl: "https://github.com/a/b", siteUrl: null };

function renderForm(save = vi.fn(async () => ({ error: "unknown" as const }))) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <EditProjectForm project={project} tags={tags} save={save} />
    </NextIntlClientProvider>,
  );
  return save;
}

describe("EditProjectForm", () => {
  it("abre com o que já foi salvo", () => {
    renderForm();
    expect(screen.getByLabelText("Título")).toHaveValue("Kanban");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Um quadro.");
    expect(screen.getByRole("checkbox", { name: "react" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "css" })).not.toBeChecked();
    expect(screen.getByLabelText("Repositório")).toHaveValue("https://github.com/a/b");
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", "/projetos/kanban-abc123");
  });

  it("salva os campos editados", async () => {
    const save = renderForm();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Kanban 2" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "css" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("p1", { title: "Kanban 2", description: "Um quadro.", tags: ["react", "css"], repoUrl: "https://github.com/a/b", siteUrl: "" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu para salvar");
  });

  it("sem tags não envia", async () => {
    const save = renderForm();
    fireEvent.click(screen.getByRole("checkbox", { name: "react" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Escolha pelo menos 1 tag.")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
