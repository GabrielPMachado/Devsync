import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { AdminProfile } from "@/lib/moderation/profile-queries";

const actions = {
  setBadge: vi.fn(async () => ({ ok: true }) as const),
  setItemGrant: vi.fn(async () => ({ ok: true }) as const),
  updateProfileAsAdmin: vi.fn(async () => ({ ok: true }) as const),
  setCatalogItem: vi.fn(async () => ({ ok: true }) as const),
};
vi.mock("@/lib/moderation/profile-actions", () => actions);
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { ProfileManager } = await import("./profile-manager");
const { CatalogPanel } = await import("./catalog-panel");

const profile: AdminProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "lia",
  displayName: "Lia",
  avatarUrl: null,
  isAdmin: false,
  suspended: false,
  createdAt: "2026-11-20T10:00:00Z",
  headline: null,
  location: null,
  status: null,
  bio: "Oi",
  bannerUrl: null,
  bannerPreset: null,
  accent: null,
  avatarFrame: "neon",
  badges: [{ badge: "mentor", awardedAt: "2026-11-21T10:00:00Z" }],
  grants: [{ kind: "frame", key: "dourada" }],
  history: [],
};

const NONE = { badge: [], frame: [], banner: [], accent: [] };
const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="pt-BR" messages={messages}>{ui}</NextIntlClientProvider>);

beforeEach(() => vi.clearAllMocks());

describe("<ProfileManager />", () => {
  it("dá e tira insígnia, com ou sem aviso", async () => {
    wrap(<ProfileManager profile={profile} disabled={NONE} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tirar: Mentor" })));
    expect(actions.setBadge).toHaveBeenCalledWith(profile.id, "mentor", false, true);
    fireEvent.click(screen.getByLabelText("Avisar a pessoa ao dar"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Dar: Sábio" })));
    expect(actions.setBadge).toHaveBeenCalledWith(profile.id, "sage", true, false);
    expect(refresh).toHaveBeenCalled();
  });

  it("libera e tira borda à mão", async () => {
    wrap(<ProfileManager profile={profile} disabled={NONE} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tirar: Dourada" })));
    expect(actions.setItemGrant).toHaveBeenCalledWith(profile.id, "frame", "dourada", false);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Liberar: Prisma" })));
    expect(actions.setItemGrant).toHaveBeenCalledWith(profile.id, "frame", "prisma", true);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: `Liberar: ${messages.ProfileStyle.banner_hiperespaco}` })));
    expect(actions.setItemGrant).toHaveBeenCalledWith(profile.id, "banner", "hiperespaco", true);
  });

  it("o aviso desmarcado continua desmarcado depois de dar uma insígnia", async () => {
    const { rerender } = wrap(<ProfileManager profile={profile} disabled={NONE} />);
    fireEvent.click(screen.getByLabelText("Avisar a pessoa ao dar"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Dar: Sábio" })));
    const updated = { ...profile, badges: [...profile.badges, { badge: "sage", awardedAt: "2026-11-25T10:00:00Z" }] };
    rerender(<NextIntlClientProvider locale="pt-BR" messages={messages}><ProfileManager profile={updated} disabled={NONE} /></NextIntlClientProvider>);
    expect(screen.getByLabelText("Avisar a pessoa ao dar")).not.toBeChecked();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Dar: Curioso" })));
    expect(actions.setBadge).toHaveBeenLastCalledWith(profile.id, "curious", true, false);
  });

  it("salva só os campos que mudaram", async () => {
    wrap(<ProfileManager profile={profile} disabled={NONE} />);
    const save = screen.getByRole("button", { name: "Salvar dados" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Lia Souza" } });
    await act(async () => fireEvent.click(save));
    expect(actions.updateProfileAsAdmin).toHaveBeenCalledWith(profile.id, { displayName: "Lia Souza" });
  });

  it("mostra o erro do banco", async () => {
    actions.updateProfileAsAdmin.mockResolvedValueOnce({ error: "usernameTaken" } as never);
    wrap(<ProfileManager profile={profile} disabled={NONE} />);
    fireEvent.change(screen.getByLabelText("@usuário"), { target: { value: "rui" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar dados" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Esse @ já está em uso.");
  });
});

describe("<CatalogPanel />", () => {
  it("desliga, liga e renomeia", async () => {
    wrap(
      <CatalogPanel
        items={[
          { kind: "banner", key: "aurora", active: true, label: null },
          { kind: "badge", key: "curious", active: false, label: null },
        ]}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Desligar: Aurora" })));
    expect(actions.setCatalogItem).toHaveBeenCalledWith("banner", "aurora", false, "");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: `Ligar: ${messages.Badges.curious_name}` })));
    expect(actions.setCatalogItem).toHaveBeenCalledWith("badge", "curious", true, "");
    fireEvent.change(screen.getByLabelText("Nome (Aurora)"), { target: { value: "Aurora clássica" } });
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Salvar nome" })[0]));
    expect(actions.setCatalogItem).toHaveBeenCalledWith("banner", "aurora", true, "Aurora clássica");
  });
});
