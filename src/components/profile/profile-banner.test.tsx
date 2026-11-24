import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BANNER_ART, ProfileBanner } from "./profile-banner";

describe("ProfileBanner", () => {
  it("a imagem enviada vence o preset", () => {
    const { container } = render(<ProfileBanner bannerUrl="https://x.supabase.co/storage/v1/object/public/banners/u1/banner.webp?v=1" preset="aurora" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("banners/u1/banner.webp"));
    expect(container.querySelector("svg")).toBeNull();
  });

  it("sem imagem, desenha o preset escolhido", () => {
    const { container } = render(<ProfileBanner preset="hex" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-banner", "hex");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("sem nada (ou preset desconhecido), cai no gradiente padrão", () => {
    for (const preset of [null, undefined, "nao-existe"]) {
      const { container, unmount } = render(<ProfileBanner preset={preset} />);
      expect(container.firstElementChild).toHaveAttribute("data-banner", "padrao");
      unmount();
    }
  });

  it("tem desenho para os 6 presets, e cada um é decorativo", () => {
    expect(Object.keys(BANNER_ART).sort()).toEqual(["aurora", "circuito", "grade", "hex", "noite", "ondas"]);
    for (const key of Object.keys(BANNER_ART)) {
      const { container, unmount } = render(<ProfileBanner preset={key} />);
      expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
      unmount();
    }
  });

  it("ids dos gradientes não colidem entre dois banners na mesma página", () => {
    const { container } = render(
      <>
        <ProfileBanner preset="aurora" />
        <ProfileBanner preset="aurora" />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
