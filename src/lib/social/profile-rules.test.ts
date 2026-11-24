import { describe, expect, it } from "vitest";
import { validateProfile } from "./profile-rules";

const base = { displayName: "Ana Souza", bio: "Front-end.", github: "", site: "", tags: ["react", "css", "a11y"] };

describe("validateProfile", () => {
  it("aceita o básico e limpa espaços", () => {
    const r = validateProfile({ ...base, displayName: "  Ana  ", bio: " oi " });
    expect(r).toEqual({ ok: true, value: { ...base, displayName: "Ana", bio: "oi" } });
  });

  it("nome obrigatório e até 80, bio até 500", () => {
    expect(validateProfile({ ...base, displayName: " " })).toMatchObject({ ok: false, errors: { displayName: "length" } });
    expect(validateProfile({ ...base, displayName: "a".repeat(81) })).toMatchObject({ ok: false, errors: { displayName: "length" } });
    expect(validateProfile({ ...base, bio: "a".repeat(501) })).toMatchObject({ ok: false, errors: { bio: "tooLong" } });
  });

  it("GitHub aceita o @ ou o link colado e guarda só o nome", () => {
    for (const g of ["anasouza", "@anasouza", "https://github.com/anasouza", "github.com/anasouza/"]) {
      expect(validateProfile({ ...base, github: g })).toMatchObject({ ok: true, value: { github: "anasouza" } });
    }
    for (const g of ["javascript:alert(1)", "ana souza", "https://gitlab.com/ana", "-".repeat(40)]) {
      expect(validateProfile({ ...base, github: g })).toMatchObject({ ok: false, errors: { github: "invalid" } });
    }
  });

  it("site só https", () => {
    expect(validateProfile({ ...base, site: "https://ana.dev" })).toMatchObject({ ok: true, value: { site: "https://ana.dev" } });
    for (const s of ["javascript:alert(1)", "http://ana.dev", "ana.dev", `https://${"a".repeat(200)}.dev`]) {
      expect(validateProfile({ ...base, site: s })).toMatchObject({ ok: false, errors: { site: "https" } });
    }
  });

  it("até 10 tecnologias, sem repetir (nenhuma também vale)", () => {
    expect(validateProfile({ ...base, tags: ["react", "React", " css "] })).toMatchObject({ ok: true, value: { tags: ["react", "css"] } });
    expect(validateProfile({ ...base, tags: [] })).toMatchObject({ ok: true });
    expect(validateProfile({ ...base, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })).toMatchObject({ ok: false, errors: { tags: "max" } });
  });
});
