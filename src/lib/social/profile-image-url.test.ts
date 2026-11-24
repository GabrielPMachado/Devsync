import { describe, expect, it } from "vitest";
import { isOwnStorageUrl } from "./profile-image-url";

const base = "https://x.supabase.co";
describe("isOwnStorageUrl", () => {
  it.each([
    [`${base}/storage/v1/object/public/avatars/u1/avatar.webp?v=1`, "avatar", true],
    [`${base}/storage/v1/object/public/banners/u1/banner.webp?v=1`, "banner", true],
    [`${base}/storage/v1/object/public/avatars/u2/avatar.webp`, "avatar", false],
    [`${base}/storage/v1/object/public/banners/u1/banner.webp`, "avatar", false],
    [`${base}/storage/v1/object/public/avatars/u1/../u2/a.webp`, "avatar", false],
    [`${base}/storage/v1/object/public/avatars/u1/%2e%2e/u2/a.webp`, "avatar", false],
    [`${base}/storage/v1/object/public/avatars/u1//a.webp`, "avatar", false],
    [`${base}/storage/v1/object/public/avatars/u1/`, "avatar", false],
    ["https://evil.com/storage/v1/object/public/avatars/u1/a.webp", "avatar", false],
    [`${base}.evil.com/storage/v1/object/public/avatars/u1/a.webp`, "avatar", false],
    ["não é url", "avatar", false],
  ] as const)("%s (%s) = %s", (url, kind, ok) => expect(isOwnStorageUrl(url, base, kind, "u1")).toBe(ok));

  it("aceita a URL base com barra no fim", () =>
    expect(isOwnStorageUrl(`${base}/storage/v1/object/public/avatars/u1/avatar.webp`, `${base}/`, "avatar", "u1")).toBe(true));
});
