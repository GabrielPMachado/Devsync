import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { AnswerView } from "@/lib/studies/queries";

vi.mock("@/app/(app)/estudos/actions", () => ({ voteAnswer: vi.fn(), acceptAnswer: vi.fn(), toggleOutdated: vi.fn() }));
vi.mock("@/lib/moderation/actions", () => ({ reportContent: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/estudos/x" }));
const { AnswerCard } = await import("./answer-card");

const now = new Date("2026-11-23T12:00:00Z");
const base: AnswerView = {
  id: "a1",
  authorId: "bruno",
  bodyMd: "Use `revalidatePath`",
  techVersion: "Next.js 13",
  score: 3,
  outdatedFlags: 0,
  createdAt: "2026-11-20T12:00:00Z",
  author: { username: "bruno", displayName: "Bruno", avatarUrl: null },
  myVote: 0,
  flaggedByMe: false,
  edited: false,
};
const question = { id: "q1", slug: "q", authorId: "ana", acceptedAnswerId: null as string | null };

function show(answer: Partial<AnswerView>, opts: { viewerId?: string | null; recentTop?: boolean; accepted?: boolean } = {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      <AnswerCard
        answer={{ ...base, ...answer }}
        question={{ ...question, acceptedAnswerId: opts.accepted ? "a1" : null }}
        viewerId={opts.viewerId === undefined ? "carla" : opts.viewerId}
        recentTop={!!opts.recentTop}
        now={now}
      />
    </NextIntlClientProvider>,
  );
}

describe("AnswerCard", () => {
  it("placar negativo aparece como 0", () => {
    show({ score: -4 });
    expect(screen.getByText("Pontuação:").parentElement).toHaveTextContent(/^Pontuação: 0$/);
  });

  it("selos de aceita e de mais votada recentemente", () => {
    show({}, { accepted: true });
    expect(screen.getAllByText("Resposta aceita").length).toBeGreaterThan(0);
    show({ id: "a2" }, { recentTop: true });
    expect(screen.getByText("Mais votada recentemente")).toBeInTheDocument();
  });

  it("aviso discreto para resposta com mais de 2 anos", () => {
    show({ createdAt: "2023-03-01T00:00:00Z" });
    expect(screen.getByText("Pode estar desatualizada")).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("aviso forte com 3 marcações, citando a versão", () => {
    show({ outdatedFlags: 4 });
    expect(screen.getByRole("note")).toHaveTextContent("Escrita para Next.js 13. 4 pessoas marcaram que não funciona mais.");
  });

  it("autor não vê votos nem 'não funciona mais' na própria resposta", () => {
    show({}, { viewerId: "bruno" });
    expect(screen.queryByRole("button", { name: "Votar a favor" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Não funciona mais" })).toBeNull();
    expect(screen.getByRole("link", { name: "Editar" })).toBeInTheDocument();
  });

  it("visitante vai para /entrar ao votar", () => {
    show({}, { viewerId: null });
    expect(screen.getByRole("link", { name: "Votar a favor" })).toHaveAttribute("href", "/entrar?next=%2Festudos%2Fq");
  });
});
