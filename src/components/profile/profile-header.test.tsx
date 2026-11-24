import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { ProfileHeader, type ProfileHeaderData } from "./profile-header";

const base: ProfileHeaderData = {
  username: "ana",
  displayName: "Ana Souza",
  avatarUrl: null,
  headline: null,
  location: null,
  status: null,
  bannerUrl: null,
  bannerPreset: null,
  avatarFrame: null,
  accent: null,
  links: {},
  followersCount: 0,
  followingCount: 0,
};

function show(p: Partial<ProfileHeaderData>, extra: { basePath?: string; joined?: string } = {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      <ProfileHeader profile={{ ...base, ...p }} actions={<button>Seguir</button>} {...extra} />
    </NextIntlClientProvider>,
  );
}

describe("ProfileHeader", () => {
  it("mostra nome, @, cargo, status e localização", () => {
    show({ headline: "Dev front-end na Acme", status: "open_to_work", location: "Recife, PE" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana Souza");
    expect(screen.getByText("@ana")).toBeInTheDocument();
    expect(screen.getByText("Dev front-end na Acme")).toBeInTheDocument();
    expect(screen.getByText("Aberto a oportunidades")).toBeInTheDocument();
    expect(screen.getByText("Recife, PE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seguir" })).toBeInTheDocument();
  });

  it("sem nome de exibição, usa o @ como nome", () => {
    show({ displayName: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ana");
  });

  it("sem cargo, status ou local, não deixa buracos", () => {
    const { container } = show({});
    expect(container.querySelector("[data-status]")).toBeNull();
    expect(screen.queryByText("Localização:")).toBeNull();
  });

  it("monta os links de cada rede com endereço completo", () => {
    show({ links: { github: "ana", linkedin: "ana-souza", x: "ana_dev", youtube: "anacoda", site: "https://ana.dev/" } });
    const nav = screen.getByRole("list", { name: "Links de Ana Souza" });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "https://github.com/ana",
      "https://www.linkedin.com/in/ana-souza",
      "https://x.com/ana_dev",
      "https://www.youtube.com/@anacoda",
      "https://ana.dev/",
    ]);
    for (const a of within(nav).getAllByRole("link")) {
      expect(a).toHaveAttribute("rel", expect.stringContaining("nofollow"));
      expect(a).toHaveAccessibleName();
    }
  });

  it("os números ficam numa linha discreta, com links para seguidores e seguindo", () => {
    show({ followersCount: 120, followingCount: 34 }, { basePath: "/@ana" });
    expect(screen.getByRole("link", { name: "120 seguidores" })).toHaveAttribute("href", "/@ana/seguidores");
    expect(screen.getByRole("link", { name: "34 seguindo" })).toHaveAttribute("href", "/@ana/seguindo");
  });

  it("aplica banner, borda e cor de destaque", () => {
    const { container } = show({ bannerPreset: "hex", avatarFrame: "neon", accent: "violeta" });
    expect(container.querySelector('[data-banner="hex"]')).not.toBeNull();
    expect(container.querySelector('[data-frame="neon"]')).not.toBeNull();
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--accent")).toBe("#8B5CF6");
  });
});
