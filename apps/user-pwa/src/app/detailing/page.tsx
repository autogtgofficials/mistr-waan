import { redirect } from "next/navigation";

/** Legacy entry — detailing now lives in the unified services catalog. */
export default function DetailingRedirect() {
  redirect("/services");
}
