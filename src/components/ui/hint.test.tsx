import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hint } from "./hint";

function setup() {
  render(
    <div>
      <Hint content={<span>Publique 5 projetos</span>}>
        {(props) => (
          <button type="button" {...props}>
            Construtor
          </button>
        )}
      </Hint>
      <p>fora</p>
    </div>,
  );
  const trigger = screen.getByRole("button", { name: "Construtor" });
  const tip = screen.getByRole("tooltip", { hidden: true });
  return { trigger, tip, isOpen: () => tip.dataset.open === "true" };
}

describe("Hint", () => {
  it("fica fechada, mas descreve o gatilho para leitores de tela", () => {
    const { trigger, tip, isOpen } = setup();
    expect(isOpen()).toBe(false);
    expect(trigger).toHaveAttribute("aria-describedby", tip.id);
    expect(trigger).toHaveAccessibleDescription("Publique 5 projetos");
  });

  it("abre ao passar o mouse e fecha ao sair", () => {
    const { trigger, isOpen } = setup();
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    expect(isOpen()).toBe(true);
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    expect(isOpen()).toBe(false);
  });

  it("no toque, abre e fecha a cada toque e fecha ao tocar fora", () => {
    const { trigger, isOpen } = setup();
    fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    expect(isOpen()).toBe(false);
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    expect(isOpen()).toBe(true);
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    expect(isOpen()).toBe(false);
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByText("fora"), { pointerType: "touch" });
    expect(isOpen()).toBe(false);
  });

  it("abre com o foco do teclado e fecha com Esc", () => {
    const { trigger, isOpen } = setup();
    fireEvent.keyDown(document, { key: "Tab" });
    fireEvent.focus(trigger);
    expect(isOpen()).toBe(true);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(isOpen()).toBe(false);
    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    expect(isOpen()).toBe(false);
  });
});
