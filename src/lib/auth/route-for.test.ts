import { describe, expect, it } from "vitest";
import { routeFor } from "./route-for";

const novo = { username: null };
const pronto = { username: "gabriel" };

describe("routeFor", () => {
  it("visitante pode ver o app público e as telas de entrar", () => {
    expect(routeFor("app", null)).toBeNull();
    expect(routeFor("auth", null)).toBeNull();
  });

  it("visitante em página que exige login vai para /entrar com o destino", () => {
    expect(routeFor("private", null, "/notificacoes")).toBe("/entrar?next=%2Fnotificacoes");
    expect(routeFor("onboarding", null)).toBe("/entrar?next=%2Fboas-vindas");
  });

  it("quem ainda não tem @usuário vai para /boas-vindas", () => {
    expect(routeFor("app", novo)).toBe("/boas-vindas");
    expect(routeFor("private", novo)).toBe("/boas-vindas");
    expect(routeFor("auth", novo)).toBe("/boas-vindas");
    expect(routeFor("onboarding", novo)).toBeNull();
  });

  it("com @usuário, entrar e boas-vindas levam ao destino seguro", () => {
    expect(routeFor("auth", pronto)).toBe("/");
    expect(routeFor("auth", pronto, "/estudos")).toBe("/estudos");
    expect(routeFor("auth", pronto, "//evil.com")).toBe("/");
    expect(routeFor("onboarding", pronto)).toBe("/");
    expect(routeFor("app", pronto)).toBeNull();
    expect(routeFor("private", pronto)).toBeNull();
  });
});
