import { describe, expect, it } from "vitest";
import { validateProject } from "./rules";

const ok = { title: "Kanban colaborativo", description: "Um quadro.", tags: ["react", "nextjs"], repoUrl: "", siteUrl: "" };

describe("validateProject", () => {
  it("aceita o mínimo e normaliza", () => {
    const r = validateProject({ ...ok, title: "  Kanban  ", tags: ["React", "react", " nextjs "] });
    expect(r).toEqual({ ok: true, value: { ...ok, title: "Kanban", tags: ["react", "nextjs"] } });
  });
  it("título de 3 a 120 caracteres", () => {
    expect(validateProject({ ...ok, title: "ab" })).toMatchObject({ ok: false, errors: { title: "length" } });
    expect(validateProject({ ...ok, title: "a".repeat(121) })).toMatchObject({ ok: false, errors: { title: "length" } });
  });
  it("descrição até 20 000 caracteres", () => {
    expect(validateProject({ ...ok, description: "a".repeat(20001) })).toMatchObject({ ok: false, errors: { description: "tooLong" } });
  });
  it("de 1 a 5 tags", () => {
    expect(validateProject({ ...ok, tags: [] })).toMatchObject({ ok: false, errors: { tags: "min" } });
    expect(validateProject({ ...ok, tags: ["a", "b", "c", "d", "e", "f"] })).toMatchObject({ ok: false, errors: { tags: "max" } });
  });
  it("links precisam ser https", () => {
    expect(validateProject({ ...ok, repoUrl: "http://github.com/x" })).toMatchObject({ ok: false, errors: { repoUrl: "https" } });
    expect(validateProject({ ...ok, siteUrl: "javascript:alert(1)" })).toMatchObject({ ok: false, errors: { siteUrl: "https" } });
    expect(validateProject({ ...ok, repoUrl: "https://github.com/x" }).ok).toBe(true);
  });
});
