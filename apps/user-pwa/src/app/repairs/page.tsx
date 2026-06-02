import { redirect } from "next/navigation";

/** Legacy entry — the symptom wizard is gone; pick services in the catalog. */
export default function RepairsRedirect() {
  redirect("/services");
}
