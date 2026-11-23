import { Suspense } from "react";
import { Gate } from "@/components/auth/gate";
import { AppShell } from "@/components/shell/app-shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      {/* Quem entrou e ainda não escolheu o @usuário vai para /boas-vindas. */}
      <Suspense fallback={null}>
        <Gate area="app" />
      </Suspense>
      {children}
    </AppShell>
  );
}
