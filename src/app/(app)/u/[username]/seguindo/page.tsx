import { Suspense } from "react";
import { ConnectionsPage } from "@/components/social/connections-page";

type Params = PageProps<"/u/[username]/seguindo">["params"];

export default function Page({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-bg-surface" />}>
        <List params={params} />
      </Suspense>
    </main>
  );
}

async function List({ params }: { params: Params }) {
  const { username } = await params;
  return <ConnectionsPage username={username} who="following" />;
}
