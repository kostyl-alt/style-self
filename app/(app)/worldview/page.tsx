import { redirect } from "next/navigation";

export default function WorldviewRedirect() {
  redirect("/self?tab=worldview");
}
