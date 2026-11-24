import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { QueueItem } from "@/lib/moderation/queries";

const moderate = vi.fn<(...a: unknown[]) => Promise<{ ok: true } | { error: string }>>(async () => ({ ok: true }));
const markDuplicate = vi.fn<(...a: unknown[]) => Promise<{ ok: true } | { error: string }>>(async () => ({ ok: true }));
vi.mock("@/lib/moderation/actions", () => ({
  moderate: (...a: unknown[]) => moderate(...a),
  markDuplicate: (...a: unknown[]) => markDuplicate(...a),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { QueueCard } = await import("./queue-card");

const base: QueueItem = {
  targetType: "answer",
  targetId: "a1",
  reportCount: 2,
  reasons: ["Grosseria ou ofensa", "Spam ou propaganda: link"],
  firstReportedAt: "2026-11-24T10:00:00Z",
  lastReportedAt: "2026-11-24T11:00:00Z",
  resolvedAt: null,
  resolution: null,
  title: "Como centralizar uma div?",
  preview: "Pergunta boba, pesquisa no Google",
  path: "/estudos/como-centralizar#resposta-a1",
  hidden: false,
  demoStatus: null,
  author: { id: "u2", username: "bruno", suspended: false },
};

function show(item: QueueItem, mode: "open" | "resolved" = "open") {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} now={new Date("2026-11-24T12:00:00Z")} timeZone="America/Sao_Paulo">
      <QueueCard item={item} mode={mode} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("QueueCard", () => {
  it("mostra contagem, motivos, prévia, autor e link", () => {
    show(base);
    expect(screen.getByText("2 denúncias")).toBeInTheDocument();
    expect(screen.getByText("Grosseria ou ofensa")).toBeInTheDocument();
    expect(screen.getByText("Pergunta boba, pesquisa no Google")).toBeInTheDocument();
    expect(screen.getByText("por @bruno")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "/estudos/como-centralizar#resposta-a1");
  });

  it("ocultar chama a ação e atualiza a página", async () => {
    show(base);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    await waitFor(() => expect(moderate).toHaveBeenCalledWith({ target: "answer", targetId: "a1", action: "hide", authorId: "u2" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("suspender conta e descartar", async () => {
    show(base);
    fireEvent.click(screen.getByRole("button", { name: "Suspender conta" }));
    await waitFor(() => expect(moderate).toHaveBeenCalledWith(expect.objectContaining({ action: "suspendAuthor", authorId: "u2" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Descartar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(moderate).toHaveBeenCalledWith(expect.objectContaining({ action: "dismiss" })));
  });

  it("demo: suspender demo, sem ocultar", () => {
    show({ ...base, targetType: "demo", targetId: "d1", demoStatus: "live", title: "https://golpe.dev" });
    expect(screen.getByRole("button", { name: "Suspender demo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ocultar" })).toBeNull();
  });

  it("pergunta: marcar repetida", async () => {
    show({ ...base, targetType: "question", targetId: "q1" });
    fireEvent.change(screen.getByLabelText("Repetida de"), { target: { value: "/estudos/original-abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar repetida" }));
    await waitFor(() => expect(markDuplicate).toHaveBeenCalledWith("q1", "/estudos/original-abc"));
  });

  it("resolvida e oculta: só desfazer", () => {
    show({ ...base, hidden: true, resolution: "actioned", resolvedAt: "2026-11-24T11:30:00Z", author: { id: "u2", username: "bruno", suspended: true } }, "resolved");
    expect(screen.getByRole("button", { name: "Mostrar de novo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reativar conta" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ocultar" })).toBeNull();
  });

  it("conteúdo apagado", () => {
    show({ ...base, title: null, preview: null, path: null, author: null });
    expect(screen.getByText("O conteúdo foi apagado.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir" })).toBeNull();
  });

  it("erro aparece", async () => {
    moderate.mockResolvedValueOnce({ error: "unknown" });
    show(base);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu certo.");
  });
});
