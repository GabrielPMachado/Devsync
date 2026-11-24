import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { AchievementsBlock } from "./achievements-block";
import { BadgesSection } from "./badges-section";
import { ProfileBadges } from "./profile-badges";

const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      {ui}
    </NextIntlClientProvider>,
  );

describe("ProfileBadges", () => {
  it("mostra até 3 insígnias com nome acessível", () => {
    wrap(<ProfileBadges badges={["mentor", "founder", "curious", "popular"]} name="Ana" />);
    const list = screen.getByRole("list", { name: "Insígnias de Ana" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByLabelText("Mentor")).toBeInTheDocument();
    expect(screen.getAllByRole("tooltip").map((t) => t.textContent)).toEqual(["Mentor", "Membro fundador", "Curioso"]);
  });

  it("sem insígnias, não ocupa espaço", () => {
    const { container } = wrap(<ProfileBadges badges={[]} name="Ana" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AchievementsBlock", () => {
  it("lista as conquistadas na ordem do catálogo, com a data", () => {
    wrap(
      <AchievementsBlock
        badges={[
          { badge: "mentor", awardedAt: "2026-11-20T12:00:00Z" },
          { badge: "founder", awardedAt: "2026-01-02T12:00:00Z" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: /Conquistas/ })).toHaveTextContent("2 insígnias");
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Membro fundador");
    expect(items[1]).toHaveTextContent("Mentor");
    expect(items[1]).toHaveTextContent("Conquistada em 20 de nov. de 2026");
  });
});

describe("BadgesSection", () => {
  it("bloqueadas mostram como ganhar; conquistadas são marcáveis até 3", () => {
    const onChange = vi.fn();
    const { container } = wrap(<BadgesSection earned={["founder", "curious", "mentor", "popular"]} initial={["founder", "builder"]} onChange={onChange} />);
    expect(screen.getByText("Como ganhar: Publicar 5 projetos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Construtor/ })).toBeNull();

    const hidden = () => [...container.querySelectorAll<HTMLInputElement>('input[name="shown_badges"]')].map((i) => i.value);
    expect(hidden()).toEqual(["founder"]);

    fireEvent.click(screen.getByRole("button", { name: /Curioso/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mentor/ }));
    expect(hidden()).toEqual(["founder", "curious", "mentor"]);
    expect(screen.getByRole("button", { name: /Popular/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Você já marcou 3");

    fireEvent.click(screen.getByRole("button", { name: /Membro fundador/ }));
    expect(hidden()).toEqual(["curious", "mentor"]);
    expect(onChange).toHaveBeenLastCalledWith(["curious", "mentor"]);
  });
});
