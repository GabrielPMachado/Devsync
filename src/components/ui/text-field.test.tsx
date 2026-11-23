import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("liga o rótulo e a ajuda ao campo", () => {
    render(<TextField label="E-mail" name="email" help="Sem senha." />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAccessibleDescription("Sem senha.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("mostra o erro no lugar da ajuda e marca o campo como inválido", () => {
    render(<TextField label="E-mail" name="email" help="Sem senha." error="Digite um e-mail válido." />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAccessibleDescription("Digite um e-mail válido.");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
