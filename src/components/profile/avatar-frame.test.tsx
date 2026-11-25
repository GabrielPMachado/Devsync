import { FRAMES } from "@/lib/social/profile-style";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvatarFrame, FRAME_ART } from "./avatar-frame";

const photo = <span data-testid="foto">foto</span>;

describe("AvatarFrame", () => {
  it("sem borda, devolve o avatar sem moldura", () => {
    const { container } = render(<AvatarFrame frame={null}>{photo}</AvatarFrame>);
    expect(screen.getByTestId("foto")).toBeInTheDocument();
    expect(container.querySelector("[data-frame]")).toBeNull();
  });

  it("borda desconhecida é ignorada", () => {
    const { container } = render(<AvatarFrame frame="arco-iris">{photo}</AvatarFrame>);
    expect(container.querySelector("[data-frame]")).toBeNull();
  });

  it("tem desenho para as 36 bordas do catálogo", () => {
    expect(Object.keys(FRAME_ART).sort()).toEqual(FRAMES.map((f) => f.key).sort());
  });

  it("envolve o avatar com a borda escolhida", () => {
    for (const key of Object.keys(FRAME_ART)) {
      const { container, unmount } = render(<AvatarFrame frame={key}>{photo}</AvatarFrame>);
      const frame = container.querySelector(`[data-frame="${key}"]`);
      expect(frame).not.toBeNull();
      expect(frame).toContainElement(screen.getByTestId("foto"));
      unmount();
    }
  });

  it("as 18 bordas novas são animadas e tudo o que desenham é decorativo", () => {
    for (const f of FRAMES.slice(18)) {
      const { container, unmount } = render(<AvatarFrame frame={f.key}>{photo}</AvatarFrame>);
      expect(container.querySelector(".pm"), f.key).not.toBeNull();
      for (const el of container.querySelectorAll("[data-frame] > :not([data-testid])")) expect(el, f.key).toHaveAttribute("aria-hidden", "true");
      unmount();
    }
  });

  it("os colchetes são decorativos", () => {
    const { container } = render(<AvatarFrame frame="colchetes">{photo}</AvatarFrame>);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
