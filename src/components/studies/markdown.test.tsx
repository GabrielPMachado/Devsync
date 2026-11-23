import { render as rtlRender } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { Markdown } from "./markdown";

const render = (ui: ReactNode) =>
  rtlRender(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

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
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("x");
  });

  it("títulos do texto não competem com o h1 da página", () => {
    const { container } = render(<Markdown source={"# Grande\n\n## Médio"} />);
    expect(container.querySelector("h1, h2")).toBeNull();
    expect(container.querySelectorAll("h3")).toHaveLength(2);
  });

  it("notas ficam na mesma aba e não colidem entre blocos", () => {
    const { container } = render(
      <>
        <Markdown source={"Texto[^1]\n\n[^1]: nota"} />
        <Markdown source={"Outro[^1]\n\n[^1]: nota"} />
      </>,
    );
    const refs = [...container.querySelectorAll("a[data-footnote-ref]")];
    expect(refs).toHaveLength(2);
    expect(refs[0].getAttribute("target")).toBeNull();
    expect(refs[0].getAttribute("href")).not.toBe(refs[1].getAttribute("href"));
    expect(container.textContent).toContain("Notas");
  });

  it("tabelas do GFM", () => {
    const { container } = render(<Markdown source={"| a | b |\n|---|---|\n| 1 | 2 |"} />);
    expect(container.querySelector("table")).not.toBeNull();
  });
});
