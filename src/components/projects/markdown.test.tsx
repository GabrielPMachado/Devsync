import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

describe("Markdown", () => {
  it("formata títulos, listas e código", () => {
    render(<Markdown text={"## Como foi feito\n\n- Next.js\n\n```ts\nconst a = 1;\n```"} />);
    expect(screen.getByRole("heading", { name: "Como foi feito" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Next.js");
    expect(screen.getByText("const a = 1;")).toBeInTheDocument();
  });

  it("não renderiza HTML cru nem links javascript:", () => {
    const { container } = render(<Markdown text={'<script>alert(1)</script><img src=x onerror="alert(1)"> [x](javascript:alert(1))'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it("links externos não abrem outra guia", () => {
    const { container } = render(<Markdown text="[site](https://exemplo.com)" />);
    expect(container.querySelector("a")).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(container.querySelector("a")).not.toHaveAttribute("target");
  });
});
