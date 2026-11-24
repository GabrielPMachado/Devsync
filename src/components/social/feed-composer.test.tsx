import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { FeedComposer } from "@/components/social/feed-composer";

function renderComposer() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <FeedComposer name="Gabriel Machado" />
    </NextIntlClientProvider>,
  );
}

describe("<FeedComposer />", () => {
  it("cumprimenta a pessoa e leva para publicar projeto ou pergunta", () => {
    renderComposer();
    expect(screen.getByText("Olá, Gabriel Machado! O que você está construindo hoje?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Projeto com demo/ })).toHaveAttribute("href", "/projetos/novo");
    expect(screen.getByRole("link", { name: /Pergunta/ })).toHaveAttribute("href", "/estudos/perguntar");
  });

  it("no celular empilha o texto acima dos botões, sem espremer a frase", () => {
    const { container } = renderComposer();
    const card = container.firstElementChild!;
    expect(card.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(card.className).toMatch(/sm:flex-row/);
    expect(screen.getByText(/Olá, Gabriel/).className).toMatch(/text-text-secondary/);
  });
});
