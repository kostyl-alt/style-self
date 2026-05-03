import { redirect } from "next/navigation";

export default function ClosetRedirect() {
  redirect("/outfit?tab=closet");
}
