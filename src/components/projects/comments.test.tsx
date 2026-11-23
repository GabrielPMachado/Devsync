import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { CommentNode } from "@/lib/comments/tree";

const addComment = vi.fn(async () => ({}));
vi.mock("@/app/(app)/projetos/actions", () => ({ addComment, deleteComment: vi.fn(async () => ({})) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { Comments } = await import("./comments");

const author = { username: "lucas", displayName: "Lucas Pereira", avatarUrl: null };
const nodes: CommentNode[] = [
  {
    id: "c1",
    parentId: null,
    bodyMd: "Ficou muito bom!",
    createdAt: "2026-11-23T10:00:00Z",
    authorId: "u2",
    author,
    replies: [{ id: "c2", parentId: "c1", bodyMd: "Valeu!", createdAt: "2026-11-23T10:30:00Z", authorId: "u1", author: { username: "gabriel", displayName: "Gabriel", avatarUrl: null } }],
  },
];

function show(viewerId: string | null) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} now={new Date("2026-11-23T11:00:00Z")} timeZone="America/Sao_Paulo">
      <Comments projectId="p1" path="/projetos/x" nodes={nodes} total={2} viewerId={viewerId} />
    </NextIntlClientProvider>,
  );
}

describe("Comments", () => {
  it("mostra a resposta dentro do comentário", () => {
    show(null);
    expect(screen.getByRole("heading", { name: "2 comentários" })).toBeInTheDocument();
    const reply = screen.getByText("Valeu!").closest("li")!;
    expect(reply.parentElement?.closest("li")).toHaveTextContent("Ficou muito bom!");
  });

  it("visitante vê o convite para entrar, sem Responder", () => {
    show(null);
    expect(screen.getByRole("link", { name: "Entre para comentar" })).toHaveAttribute("href", "/entrar?next=%2Fprojetos%2Fx");
    expect(screen.queryByRole("button", { name: "Responder" })).toBeNull();
  });

  it("logado comenta e responde", async () => {
    show("u1");
    fireEvent.change(screen.getByLabelText("Escreva um comentário"), { target: { value: "Show!" } });
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }));
    await waitFor(() => expect(addComment).toHaveBeenCalledWith("p1", "Show!", null, "/projetos/x"));

    fireEvent.click(screen.getAllByRole("button", { name: "Responder" })[0]!);
    fireEvent.change(screen.getByLabelText("Responder a Lucas Pereira"), { target: { value: "Também achei" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    await waitFor(() => expect(addComment).toHaveBeenCalledWith("p1", "Também achei", "c1", "/projetos/x"));
  });

  it("só o autor vê Apagar", () => {
    show("u1");
    expect(screen.getAllByRole("button", { name: "Apagar comentário" })).toHaveLength(1);
  });
});
