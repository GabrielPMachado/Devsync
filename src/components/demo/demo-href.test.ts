import { describe, expect, it } from "vitest";
import { closeDemoHref, openDemoHref } from "./demo-href";

describe("links da camada de demo", () => {
  it("abre com ?demo= mantendo os outros parâmetros", () => {
    expect(openDemoHref("/projetos", "", "d1")).toBe("/projetos?demo=d1");
    expect(openDemoHref("/projetos/x", "?publicado=1", "d1")).toBe("/projetos/x?publicado=1&demo=d1");
    expect(openDemoHref("/", "?demo=velha", "d2")).toBe("/?demo=d2");
  });
  it("fecha tirando só o ?demo=", () => {
    expect(closeDemoHref("/projetos", "?demo=d1")).toBe("/projetos");
    expect(closeDemoHref("/projetos/x", "?publicado=1&demo=d1")).toBe("/projetos/x?publicado=1");
  });
});
