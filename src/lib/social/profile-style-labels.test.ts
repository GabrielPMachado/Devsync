// @vitest-environment node
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { ACCENTS, BANNER_PRESETS, FRAMES, STATUSES } from "./profile-style";

describe("rótulos do catálogo do perfil", () => {
  it("toda chave do catálogo tem rótulo em PT-BR", () => {
    const labels = messages.ProfileStyle as Record<string, string>;
    const keys = [...STATUSES.map((k) => `status_${k}`), ...BANNER_PRESETS.map((k) => `banner_${k}`), ...FRAMES.map((f) => `frame_${f.key}`), ...ACCENTS.map((k) => `accent_${k}`)];
    for (const k of keys) expect(labels[k], k).toBeTruthy();
  });
});
