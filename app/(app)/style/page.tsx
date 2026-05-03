import { redirect } from "next/navigation";

export default function StyleRedirect({ searchParams }: { searchParams?: { tab?: string } }) {
  const tab = searchParams?.tab;
  if (tab === "virtual") redirect("/shop");
  if (tab === "consult") redirect("/outfit?tab=consult");
  if (tab === "saved")   redirect("/self");
  redirect("/outfit");
}
