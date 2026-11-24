import { describe, expect, it } from "vitest";
import { validateProfile } from "./profile-rules";

const base = {
  displayName: "Ana Souza",
  bio: "Front-end.",
  github: "",
  site: "",
  linkedin: "",
  x: "",
  youtube: "",
  headline: "",
  location: "",
  status: "",
  bannerPreset: "",
  avatarFrame: "",
  accent: "",
  tags: ["react", "css", "a11y"],
};

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

  it("cargo até 80 e localização até 60, sem espaços sobrando", () => {
    expect(validateProfile({ ...base, headline: " Dev na Acme ", location: " SP " })).toMatchObject({ ok: true, value: { headline: "Dev na Acme", location: "SP" } });
    expect(validateProfile({ ...base, headline: "a".repeat(81) })).toMatchObject({ ok: false, errors: { headline: "tooLong" } });
    expect(validateProfile({ ...base, location: "a".repeat(61) })).toMatchObject({ ok: false, errors: { location: "tooLong" } });
  });

  it("status, banner pronto, borda e cor só da lista (vazio = nenhum)", () => {
    expect(validateProfile({ ...base, status: "building", bannerPreset: "hex", avatarFrame: "neon", accent: "rosa" })).toMatchObject({ ok: true });
    expect(validateProfile({ ...base, status: "dormindo" })).toMatchObject({ ok: false, errors: { status: "invalid" } });
    expect(validateProfile({ ...base, bannerPreset: "x" })).toMatchObject({ ok: false, errors: { bannerPreset: "invalid" } });
    expect(validateProfile({ ...base, avatarFrame: "x" })).toMatchObject({ ok: false, errors: { avatarFrame: "invalid" } });
    expect(validateProfile({ ...base, accent: "x" })).toMatchObject({ ok: false, errors: { accent: "invalid" } });
  });

  it("LinkedIn, X e YouTube aceitam o link colado e guardam só o usuário", () => {
    for (const l of ["ana-souza", "https://www.linkedin.com/in/ana-souza/", "linkedin.com/in/ana-souza"]) {
      expect(validateProfile({ ...base, linkedin: l })).toMatchObject({ ok: true, value: { linkedin: "ana-souza" } });
    }
    for (const l of ["@ana_dev", "https://x.com/ana_dev", "twitter.com/ana_dev/"]) {
      expect(validateProfile({ ...base, x: l })).toMatchObject({ ok: true, value: { x: "ana_dev" } });
    }
    for (const l of ["@anacoda", "anacoda", "https://www.youtube.com/@anacoda"]) {
      expect(validateProfile({ ...base, youtube: l })).toMatchObject({ ok: true, value: { youtube: "anacoda" } });
    }
    expect(validateProfile({ ...base, linkedin: "javascript:alert(1)" })).toMatchObject({ ok: false, errors: { linkedin: "invalid" } });
    expect(validateProfile({ ...base, x: "nome muito comprido demais" })).toMatchObject({ ok: false, errors: { x: "invalid" } });
    expect(validateProfile({ ...base, youtube: "https://evil.com/@a" })).toMatchObject({ ok: false, errors: { youtube: "invalid" } });
  });

  it("foto e banner: ausente não mexe, vazio remove, URL do Storage passa, outra falha", () => {
    expect(validateProfile(base)).toMatchObject({ ok: true, value: { avatarUrl: undefined, bannerUrl: undefined } });
    expect(validateProfile({ ...base, avatarUrl: "", bannerUrl: "" })).toMatchObject({ ok: true, value: { avatarUrl: "", bannerUrl: "" } });
    const url = "https://abc.supabase.co/storage/v1/object/public/avatars/u1/avatar.webp?v=1";
    expect(validateProfile({ ...base, avatarUrl: url })).toMatchObject({ ok: true, value: { avatarUrl: url } });
    expect(validateProfile({ ...base, avatarUrl: "javascript:alert(1)" })).toMatchObject({ ok: false, errors: { avatarUrl: "invalid" } });
    expect(validateProfile({ ...base, bannerUrl: "https://evil.example/b.png" })).toMatchObject({ ok: false, errors: { bannerUrl: "invalid" } });
  });
});
