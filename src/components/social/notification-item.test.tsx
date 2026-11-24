import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { NotificationView } from "@/lib/social/notification-queries";

vi.mock("@/app/(app)/u/[username]/actions", () => ({ toggleFollow: vi.fn() }));
const { NotificationItem } = await import("./notification-item");

const now = new Date("2026-11-24T12:00:00Z");
const ana = { id: "u2", username: "ana", displayName: "Ana Souza", avatarUrl: null };
const person = (n: number) => ({ id: `p${n}`, username: `p${n}`, displayName: `Pessoa ${n}`, avatarUrl: null });
function view(p: Partial<NotificationView>): NotificationView {
  return { key: "k", type: "like", targetType: "project", targetId: "x", actors: [ana], unread: true, createdAt: "2026-11-24T11:00:00Z", ids: ["n1"], target: { title: "Kanban colaborativo", href: "/projetos/kanban", quote: null }, ...p };
}
function show(n: NotificationView, followsActor = false) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      <ul>
        <NotificationItem n={n} now={now} followsActor={followsActor} viewerId="me" />
      </ul>
    </NextIntlClientProvider>,
  );
}

describe("NotificationItem", () => {
  it("agrupa curtidas: Ana e mais 4 pessoas curtiram", () => {
    show(view({ actors: [ana, person(1), person(2), person(3), person(4)] }));
    expect(screen.getByRole("listitem")).toHaveTextContent("Ana Souza e mais 4 pessoas curtiram seu projeto Kanban colaborativo");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projetos/kanban");
  });

  it("uma pessoa só: singular", () => {
    show(view({}));
    expect(screen.getByRole("listitem")).toHaveTextContent("Ana Souza curtiu seu projeto Kanban colaborativo");
  });

  it("novo seguidor tem Seguir de volta, a não ser que já siga", () => {
    const { unmount } = show(view({ type: "follow", targetType: "profile", target: { title: "ana", href: "/@ana", quote: null } }));
    expect(screen.getByRole("listitem")).toHaveTextContent("Ana Souza começou a seguir você");
    expect(screen.getByRole("button", { name: "Seguir @ana" })).toHaveTextContent("Seguir de volta");
    unmount();
    show(view({ type: "follow", targetType: "profile" }), true);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("alvo apagado mostra texto genérico e não vira link", () => {
    show(view({ type: "comment", targetType: "comment", target: null }));
    expect(screen.getByRole("listitem")).toHaveTextContent("Ana Souza comentou em um conteúdo removido");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("resposta aceita e demo indisponível aparecem sem pessoa", () => {
    show(view({ type: "accepted", targetType: "answer", target: { title: "Pergunta X", href: "/estudos/x#resposta-1", quote: null } }));
    expect(screen.getByRole("listitem")).toHaveTextContent("Sua resposta foi aceita em Pergunta X");
  });

  it("mostra o trecho do comentário", () => {
    show(view({ type: "comment", targetType: "comment", target: { title: "Kanban", href: "/projetos/kanban", quote: "Ficou muito bom!" } }));
    expect(screen.getByText("“Ficou muito bom!”")).toBeInTheDocument();
  });
});
