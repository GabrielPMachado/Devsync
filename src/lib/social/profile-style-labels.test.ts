// @vitest-environment node
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { FRAME_ART } from "@/components/profile/avatar-frame";
import { BANNER_ART } from "@/components/profile/profile-banner";
import { accentStyle } from "@/lib/profile/accent";
import { BADGE_GROUPS, BADGE_KEYS } from "./badges";
import { ACCENTS, BANNER_PRESETS, FRAMES, STATUSES } from "./profile-style";

describe("rótulos do catálogo do perfil", () => {
  it("toda chave do catálogo tem rótulo em PT-BR", () => {
    const labels = messages.ProfileStyle as Record<string, string>;
    const keys = [...STATUSES.map((k) => `status_${k}`), ...BANNER_PRESETS.map((k) => `banner_${k}`), ...FRAMES.map((f) => `frame_${f.key}`), ...ACCENTS.map((k) => `accent_${k}`)];
    for (const k of keys) expect(labels[k], k).toBeTruthy();
  });

  it("toda insígnia tem nome, como ganhar e grupo com título", () => {
    const b = messages.Badges as Record<string, string>;
    for (const k of BADGE_KEYS) {
      expect(b[`${k}_name`], k).toBeTruthy();
      expect(b[`${k}_how`], k).toBeTruthy();
    }
    for (const g of BADGE_GROUPS) expect(b[`group_${g.key}`], g.key).toBeTruthy();
    const s = messages.Settings as Record<string, string>;
    for (const f of FRAMES) if (f.requiresBadge) expect(s[`badge_${f.requiresBadge}`], f.key).toBeTruthy();
  });

  it("todo banner, borda e cor tem arte", () => {
    for (const k of BANNER_PRESETS) expect(BANNER_ART[k], k).toBeTypeOf("function");
    for (const f of FRAMES) expect(FRAME_ART[f.key], f.key).toBeTruthy();
    for (const a of ACCENTS) expect(accentStyle(a)["--accent-text"], a).toBeTruthy();
  });
});
