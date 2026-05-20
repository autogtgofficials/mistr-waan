import { NavBar } from "@/components/NavBar";
import { MapView } from "@/components/MapView";
import { getAllMechanics } from "@/lib/mechanics/data";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const mechanics = await getAllMechanics();
  return (
    <>
      <NavBar total={mechanics.length} />
      <main className="flex flex-1 flex-col">
        <MapView initial={mechanics} />
      </main>
    </>
  );
}
