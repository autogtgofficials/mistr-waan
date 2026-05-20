import { NavBar } from "@/components/NavBar";
import { FollowUpsView } from "@/components/FollowUpsView";
import { getAllMechanics } from "@/lib/mechanics/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const mechanics = await getAllMechanics();
  return (
    <>
      <NavBar total={mechanics.length} />
      <main className="flex-1">
        <FollowUpsView initial={mechanics} />
      </main>
    </>
  );
}
