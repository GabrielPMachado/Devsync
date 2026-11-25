import { describe, expect, it } from "vitest";
import { applyCatalogLabels, catalogItems, hiddenItems, messageKey, type CatalogRow } from "./catalog";

const rows: CatalogRow[] = [
  { kind: "banner", key: "aurora", active: false, label: "Aurora clássica" },
  { kind: "frame", key: "neon", active: false, label: null },
  { kind: "badge", key: "mentor", active: true, label: "Guia" },
  { kind: "accent", key: "rosa", active: false, label: null },
];

describe("messageKey", () => {
  it("aponta para a mensagem certa de cada tipo", () => {
    expect(messageKey("banner", "aurora")).toEqual(["ProfileStyle", "banner_aurora"]);
    expect(messageKey("accent", "azul")).toEqual(["ProfileStyle", "accent_azul"]);
    expect(messageKey("frame", "neon")).toEqual(["ProfileStyle", "frame_neon"]);
    expect(messageKey("badge", "mentor")).toEqual(["Badges", "mentor_name"]);
  });
});

describe("applyCatalogLabels", () => {
  it("troca só os nomes renomeados, sem mexer no original", () => {
    const messages = { ProfileStyle: { banner_aurora: "Aurora", frame_neon: "Neon" }, Badges: { mentor_name: "Mentor" }, Settings: { badge_mentor: "Mentor", x: "y" }, Other: { a: "b" } };
    const out = applyCatalogLabels(messages, rows);
    expect(out.ProfileStyle).toEqual({ banner_aurora: "Aurora clássica", frame_neon: "Neon" });
    expect(out.Badges).toEqual({ mentor_name: "Guia" });
    expect(out.Settings).toEqual({ badge_mentor: "Guia", x: "y" });
    expect(out.Other).toBe(messages.Other);
    expect(messages.ProfileStyle.banner_aurora).toBe("Aurora");
  });

  it("sem linhas devolve as mesmas mensagens", () => {
    const messages = { ProfileStyle: {} };
    expect(applyCatalogLabels(messages, [])).toBe(messages);
  });
});

describe("hiddenItems", () => {
  it("esconde os desligados, menos o que a pessoa usa ou ganhou à mão", () => {
    const hidden = hiddenItems(rows, { banner: "aurora", grants: [{ kind: "accent", key: "rosa" }] });
    expect(hidden).toEqual({ banner: [], accent: [], frame: ["neon"], badge: [] });
  });

  it("insígnia desligada some só para quem não tem", () => {
    const off: CatalogRow[] = [{ kind: "badge", key: "curious", active: false, label: null }];
    expect(hiddenItems(off, {}).badge).toEqual(["curious"]);
    expect(hiddenItems(off, { earnedBadges: ["curious"] }).badge).toEqual([]);
  });
});

describe("catalogItems", () => {
  it("lista todos os itens do código com o estado do banco", () => {
    const items = catalogItems(rows);
    const aurora = items.find((i) => i.kind === "banner" && i.key === "aurora");
    expect(aurora).toEqual({ kind: "banner", key: "aurora", active: false, label: "Aurora clássica" });
    const azul = items.find((i) => i.kind === "accent" && i.key === "azul");
    expect(azul).toEqual({ kind: "accent", key: "azul", active: true, label: null });
    expect(items.filter((i) => i.kind === "badge").length).toBe(15);
  });
});
