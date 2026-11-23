import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

describe("Markdown", () => {
  it("não renderiza HTML cru", () => {
    const { container } = render(<Markdown source={'Oi <script>alert(1)</script> <img src=x onerror="alert(1)">'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("destaca blocos de código com linguagem", () => {
    const { container } = render(<Markdown source={"```ts\nconst a: number = 1\n```"} />);
    const code = container.querySelector("pre code");
    expect(code?.className).toContain("hljs");
    expect(code?.querySelector(".hljs-keyword")?.textContent).toBe("const");
  });

  it("links externos abrem fora com rel seguro; imagens viram link", () => {
    const { container } = render(<Markdown source={"[doc](https://nextjs.org) ![print](https://x.dev/a.png)"} />);
    const links = container.querySelectorAll("a");
    expect(links[0].getAttribute("rel")).toBe("nofollow ugc noopener noreferrer");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(container.querySelector("img")).toBeNull();
    expect(links[1].getAttribute("href")).toBe("https://x.dev/a.png");
  });

  it("bloqueia javascript: em links", () => {
    const { container } = render(<Markdown source={"[x](javascript:alert(1))"} />);
    expect(container.querySelector("a")?.getAttribute("href") ?? "").not.toContain("javascript");
  });

  it("tabelas do GFM", () => {
    const { container } = render(<Markdown source={"| a | b |\n|---|---|\n| 1 | 2 |"} />);
    expect(container.querySelector("table")).not.toBeNull();
  });
});
