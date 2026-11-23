import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, initials } from "./avatar";

describe("Avatar", () => {
  it("usa as iniciais do nome quando não há foto", () => {
    render(<Avatar name="Gabriel Machado" />);
    expect(screen.getByText("GM")).toBeInTheDocument();
  });

  it("mostra a foto com o nome como texto alternativo", () => {
    render(<Avatar name="Ana Souza" src="https://avatars.githubusercontent.com/u/1" />);
    expect(screen.getByRole("img", { name: "Ana Souza" })).toHaveAttribute("src", "https://avatars.githubusercontent.com/u/1");
  });

  it("iniciais: um nome só, nome vazio e @usuário", () => {
    expect(initials("ana")).toBe("A");
    expect(initials("")).toBe("?");
    expect(initials("  Júlia   Nunes Costa ")).toBe("JC");
  });
});
