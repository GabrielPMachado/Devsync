import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../messages/pt-BR.json";
import { HomeHero } from "@/components/home-hero";

describe("<HomeHero />", () => {
  it("mostra a marca e os textos em pt-BR", () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <HomeHero />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mais do que compartilhar código, conectar pessoas.",
    );
    expect(screen.getByText("Connect. Share. Develop.")).toBeInTheDocument();
    expect(screen.getByText("Em construção")).toBeInTheDocument();
  });
});
