import { NavBar } from "@/components/ops/NavBar";
import { MechanicList } from "@/components/ops/MechanicList";
import { getAllMechanics } from "@/lib/mechanics/data";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; status?: string; service?: string }>;
}) {
  const [mechanics, params] = await Promise.all([getAllMechanics(), searchParams]);
  return (
    <>
      <NavBar total={mechanics.length} />
      <main className="flex-1">
        <MechanicList
          initial={mechanics}
          initialArea={params.area}
          initialStatus={params.status}
          initialService={params.service}
        />
      </main>
    </>
  );
}
