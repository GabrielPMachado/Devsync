import { describe, expect, it } from "vitest";
import { LIMITS, openDemoZip, readDemoZip, type ZipRejection } from "../src/zip";
import { makeZip, SITE, type ZipEntry } from "./helpers";

const text = (d: Uint8Array) => new TextDecoder().decode(d);
const reason = (entries: ZipEntry[]): ZipRejection | undefined => {
  const r = readDemoZip(makeZip(entries));
  return r.ok ? undefined : r.reason;
};

describe("readDemoZip", () => {
  it("aceita site com index.html na raiz", () => {
    const r = readDemoZip(makeZip(SITE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files.map((f) => f.path).sort()).toEqual(["assets/app.js", "assets/style.css", "index.html"]);
    expect(text(r.files.find((f) => f.path === "index.html")!.data)).toContain("<h1>Oi</h1>");
  });

  it("aceita arquivos sem compressão", () => {
    expect(readDemoZip(makeZip(SITE.map((e) => ({ ...e, method: 0 as const })))).ok).toBe(true);
  });

  it("tira a pasta única de topo", () => {
    const r = readDemoZip(makeZip([{ name: "dist/" }, ...SITE.map((e) => ({ ...e, name: `dist/${e.name}` }))]));
    expect(r.ok && r.files.map((f) => f.path).sort()).toEqual(["assets/app.js", "assets/style.css", "index.html"]);
  });

  it("ignora lixo do macOS e do Windows", () => {
    const r = readDemoZip(
      makeZip([...SITE, { name: "__MACOSX/._index.html", data: "x" }, { name: ".DS_Store", data: "x" }, { name: "assets/Thumbs.db", data: "x" }]),
    );
    expect(r.ok && r.files).toHaveLength(3);
  });

  it.each([["../fora.js"], ["/etc/passwd.txt"], ["a\\b.js"], ["C:/x.js"], ["a/../../b.js"], ["a//b.js"], ["./a.js"]])(
    "recusa caminho perigoso %s",
    (name) => expect(reason([...SITE, { name, data: "x" }])).toBe("unsafe_path"),
  );

  it("recusa link simbólico", () => {
    expect(reason([...SITE, { name: "link.js", data: "/etc/passwd", mode: 0o120777 }])).toBe("symlink");
  });

  it("recusa extensão fora da lista", () => {
    expect(reason([...SITE, { name: "api.php", data: "<?php" }])).toBe("extension_not_allowed");
    expect(reason([...SITE, { name: "LICENSE", data: "MIT" }])).toBe("extension_not_allowed");
  });

  it("recusa mais de 500 arquivos", () => {
    const many = Array.from({ length: 498 }, (_, i) => ({ name: `img/${i}.png`, data: "x" }));
    expect(reason([...SITE, ...many])).toBe("too_many_files");
    expect(readDemoZip(makeZip([...SITE, ...many.slice(1)])).ok).toBe(true);
  });

  it("exige index.html na raiz ou numa pasta única", () => {
    expect(reason([{ name: "app.js", data: "x" }])).toBe("no_index");
    expect(reason([{ name: "a/index.html", data: "x" }, { name: "b/index.html", data: "x" }])).toBe("no_index");
    expect(reason([{ name: "a/b/index.html", data: "x" }])).toBe("no_index");
  });

  it("recusa entrada criptografada", () => {
    expect(reason([...SITE, { name: "x.js", data: "x", flags: 1 }])).toBe("encrypted");
  });

  it("recusa tamanho descompactado gigante", () => {
    expect(reason([...SITE, { name: "x.js", data: "x", declaredSize: 200 * 1024 * 1024 }])).toBe("too_big_uncompressed");
  });

  it("recusa tamanho declarado menor que o real (zip bomb)", () => {
    expect(reason([...SITE, { name: "x.js", data: "a".repeat(100_000), declaredSize: 10 }])).toBe("corrupt");
  });

  it("zip bomb com tamanho mentiroso para cedo, sem inflar tudo", () => {
    const bomb = makeZip([...SITE, { name: "x.js", data: new Uint8Array(20 * 1024 * 1024), declaredSize: 10 }]);
    const started = Date.now();
    expect(readDemoZip(bomb)).toEqual({ ok: false, reason: "corrupt" });
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("limite de 60 MB descompactados", () => {
    expect(reason([...SITE, { name: "x.js", data: "x", declaredSize: 61 * 1024 * 1024 }])).toBe("too_big_uncompressed");
  });

  it("openDemoZip valida tudo antes e infla um arquivo por vez", () => {
    const opened = openDemoZip(makeZip([...SITE, { name: "x.js", data: "a".repeat(1000), declaredSize: 10 }]));
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(new TextDecoder().decode(opened.files.find((f) => f.path === "index.html")!.read())).toContain("Oi");
    expect(() => opened.files.find((f) => f.path === "x.js")!.read()).toThrow(expect.objectContaining({ reason: "corrupt" }));
  });

  it("recusa nomes duplicados", () => {
    expect(reason([...SITE, { name: "index.html", data: "de novo" }])).toBe("duplicate_path");
  });

  it("recusa o que não é zip", () => {
    expect(readDemoZip(crypto.getRandomValues(new Uint8Array(1000)))).toEqual({ ok: false, reason: "not_a_zip" });
  });

  it("recusa zip maior que 64 MB (o zip sem compressão do site cabe)", () => {
    expect(LIMITS.maxZipBytes).toBe(64 * 1024 * 1024);
    expect(readDemoZip(new Uint8Array(64 * 1024 * 1024 + 1))).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("zip sem compressão (plano grátis)", () => {
  it("arquivo guardado sem compressão é lido sem inflar nem conferir CRC (CPU quase zero)", () => {
    const zip = makeZip([{ name: "index.html", data: "<h1>oi</h1>", method: 0 }, { name: "app.js", data: "x()", method: 0 }]);
    // Corrompe o CRC do app.js no diretório central e no cabeçalho local: continua aceito.
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    for (let i = 0; i < zip.length - 4; i++) {
      const sig = view.getUint32(i, true);
      if (sig === 0x04034b50) view.setUint32(i + 14, 0, true);
      if (sig === 0x02014b50) view.setUint32(i + 16, 0, true);
    }
    const result = readDemoZip(zip);
    expect(result.ok).toBe(true);
    if (result.ok) expect(new TextDecoder().decode(result.files.find((f) => f.path === "app.js")!.data)).toBe("x()");
  });

  it("arquivo guardado com tamanho mentido continua recusado", () => {
    const zip = makeZip([{ name: "index.html", data: "<h1>oi</h1>", method: 0, declaredSize: 3 }]);
    expect(readDemoZip(zip)).toEqual({ ok: false, reason: "corrupt" });
  });
});
