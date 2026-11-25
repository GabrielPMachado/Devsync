import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Mentor", "Membro fundador", "Curioso"]);
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
  it("mostra o progresso das conquistas, no total e por grupo", () => {
    wrap(<BadgesSection earned={["founder", "curious", "first_project"]} initial={[]} />);
    expect(screen.getByText("3 de 15 conquistadas")).toBeInTheDocument();
    const group = (name: string) => screen.getByRole("group", { name: new RegExp(name) });
    expect(group("Projetos")).toHaveTextContent("1 de 4");
    expect(group("Perguntas e respostas")).toHaveTextContent("1 de 7");
    expect(group("Comunidade")).toHaveTextContent("1 de 4");
    expect(within(group("Projetos")).getByRole("button", { name: /Arquiteto/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("bloqueadas só mostram como ganhar na dica flutuante, e não são marcáveis", () => {
    const { container } = wrap(<BadgesSection earned={["founder"]} initial={[]} />);
    const locked = screen.getByRole("button", { name: /Construtor/ });
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked).toHaveAccessibleDescription(/Como ganhar: Publicar 5 projetos/);
    // O requisito só existe dentro da dica (fechada até passar o mouse ou tocar).
    const how = screen.getByText(/Publicar 5 projetos/);
    expect(how.closest('[role="tooltip"]')).toHaveAttribute("data-open", "false");
    fireEvent.pointerEnter(locked, { pointerType: "mouse" });
    expect(how.closest('[role="tooltip"]')).toHaveAttribute("data-open", "true");
    fireEvent.click(locked);
    expect(container.querySelectorAll('input[name="shown_badges"]')).toHaveLength(0);
  });

  it("conquistadas são marcáveis até 3", () => {
    const onChange = vi.fn();
    const { container } = wrap(<BadgesSection earned={["founder", "curious", "mentor", "popular"]} initial={["founder", "builder"]} onChange={onChange} />);

    const hidden = () => [...container.querySelectorAll<HTMLInputElement>('input[name="shown_badges"]')].map((i) => i.value);
    expect(hidden()).toEqual(["founder"]);

    fireEvent.click(screen.getByRole("button", { name: /Curioso/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mentor/ }));
    expect(hidden()).toEqual(["founder", "curious", "mentor"]);
    expect(screen.getByRole("button", { name: /Popular/ })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: /Popular/ }));
    expect(hidden()).toEqual(["founder", "curious", "mentor"]);
    expect(screen.getByRole("status")).toHaveTextContent("Você já marcou 3");

    fireEvent.click(screen.getByRole("button", { name: /Membro fundador/ }));
    expect(hidden()).toEqual(["curious", "mentor"]);
    expect(onChange).toHaveBeenLastCalledWith(["curious", "mentor"]);
  });

  it("conquistadas mostram na dica o requisito cumprido, com cadeado aberto", () => {
    wrap(<BadgesSection earned={["builder"]} initial={[]} />);
    const earned = screen.getByRole("button", { name: /Construtor/ });
    expect(earned).toHaveAccessibleDescription(/Conquistada.*Requisito cumprido: publicar 5 projetos/);
    const tip = screen.getByText(/Requisito cumprido: publicar 5 projetos/).closest('[role="tooltip"]')!;
    expect(tip).toHaveAttribute("data-open", "false");
    expect(tip.querySelector('[data-lock="open"]')).not.toBeNull();
    fireEvent.pointerEnter(earned, { pointerType: "mouse" });
    expect(tip).toHaveAttribute("data-open", "true");
    // A bloqueada continua com o cadeado fechado.
    const lockedTip = screen.getByText(/Como ganhar: Publicar 15 projetos/).closest('[role="tooltip"]')!;
    expect(lockedTip.querySelector('[data-lock="closed"]')).not.toBeNull();
  });
});
