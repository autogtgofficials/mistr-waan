import { redirect } from "next/navigation";

/** Legacy entry — denting now lives in the unified services catalog. */
export default function DentingRedirect() {
  redirect("/services");
}
