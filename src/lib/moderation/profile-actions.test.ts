// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: (n: string, a: unknown) => rpc(n, a) }) }));
const member = { id: "u1", email: "ana@x.dev", username: "ana", displayName: "Ana", avatarUrl: null, isAdmin: false };
const admin = { ...member, id: "adm", isAdmin: true };
const getViewer = vi.fn(async () => admin as typeof admin | null);
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
const revalidatePath = vi.fn();
const updateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p), updateTag: (t: string) => updateTag(t) }));

const { setCatalogItem, setBadge, setItemGrant, updateProfileAsAdmin } = await import("./profile-actions");
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(admin);
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("permissão", () => {
  it("quem não é admin não chega no banco", async () => {
    getViewer.mockResolvedValue(member);
    await expect(setBadge(ID, "mentor", true)).resolves.toEqual({ error: "forbidden" });
    await expect(setCatalogItem("banner", "aurora", false, "")).resolves.toEqual({ error: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("setCatalogItem", () => {
  it("liga/desliga, renomeia e limpa o cache do catálogo", async () => {
    await expect(setCatalogItem("banner", "aurora", false, "  Aurora clássica ")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_set_catalog_item", { p_kind: "banner", p_key: "aurora", p_active: false, p_label: "Aurora clássica" });
    expect(updateTag).toHaveBeenCalledWith("catalog-state");
  });

  it("recusa item que não existe no código e nome longo", async () => {
    await expect(setCatalogItem("banner", "arcoiris", true, "")).resolves.toEqual({ error: "invalid" });
    await expect(setCatalogItem("banner", "aurora", true, "x".repeat(41))).resolves.toEqual({ error: "invalid" });
    await expect(setCatalogItem("banner", "aurora", true, "Aurora {nome}")).resolves.toEqual({ error: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("setBadge", () => {
  it("dá com aviso e tira", async () => {
    await setBadge(ID, "mentor", true, false);
    expect(rpc).toHaveBeenCalledWith("admin_award_badge", { p_profile: ID, p_badge: "mentor", p_notify: false });
    await setBadge(ID, "mentor", false);
    expect(rpc).toHaveBeenCalledWith("admin_revoke_badge", { p_profile: ID, p_badge: "mentor" });
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/perfis/${ID}`);
  });

  it("insígnia desconhecida não vai ao banco", async () => {
    await expect(setBadge(ID, "inventada", true)).resolves.toEqual({ error: "invalid" });
  });
});

describe("setItemGrant", () => {
  it("libera e tira item", async () => {
    await setItemGrant(ID, "frame", "dourada", true);
    expect(rpc).toHaveBeenCalledWith("admin_grant_item", { p_profile: ID, p_kind: "frame", p_key: "dourada" });
    await setItemGrant(ID, "frame", "dourada", false);
    expect(rpc).toHaveBeenCalledWith("admin_revoke_item", { p_profile: ID, p_kind: "frame", p_key: "dourada" });
  });

  it("insígnia não é item liberável", async () => {
    await expect(setItemGrant(ID, "badge", "mentor", true)).resolves.toEqual({ error: "invalid" });
  });
});

describe("updateProfileAsAdmin", () => {
  it("manda só os campos aceitos, já limpos", async () => {
    const res = await updateProfileAsAdmin(ID, { username: " Rui_S ", displayName: "Rui", bio: "", status: "learning", removeAvatar: true });
    expect(res).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_update_profile", {
      p_profile: ID,
      p_changes: { username: "rui_s", display_name: "Rui", bio: "", status: "learning", remove_avatar: true },
    });
  });

  it("valida antes do banco", async () => {
    await expect(updateProfileAsAdmin(ID, { username: "a" })).resolves.toEqual({ error: "username" });
    await expect(updateProfileAsAdmin(ID, { status: "dormindo" })).resolves.toEqual({ error: "invalid" });
    await expect(updateProfileAsAdmin(ID, { bio: "x".repeat(501) })).resolves.toEqual({ error: "tooLong" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("@ já usado vira mensagem própria", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(updateProfileAsAdmin(ID, { username: "lia" })).resolves.toEqual({ error: "usernameTaken" });
  });
});
