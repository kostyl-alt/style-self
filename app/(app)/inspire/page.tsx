import { redirect } from "next/navigation";

export default function InspireRedirect() {
  redirect("/discover?tab=inspiration");
}
