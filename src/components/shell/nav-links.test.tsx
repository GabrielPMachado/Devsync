import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { NavLinks, TabBar } = await import("./nav-links");

function withIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("NavLinks", () => {
  it("marca a página atual, inclusive em subpáginas", () => {
    pathname = "/estudos/como-usar-rls";
    withIntl(<NavLinks />);
    expect(screen.getByRole("link", { name: "Estudos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("Início só fica ativo na raiz", () => {
    pathname = "/";
    withIntl(<NavLinks />);
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  });
});

describe("TabBar", () => {
  it("tem as 5 abas do celular e o Perfil aponta para o @ da pessoa", () => {
    pathname = "/@ana";
    withIntl(<TabBar profileHref="/@ana" />);
    const names = screen.getAllByRole("link").map((a) => a.textContent);
    expect(names).toEqual(["Início", "Projetos", "Estudos", "Notificações", "Perfil"]);
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/@ana");
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("aria-current", "page");
  });
});
