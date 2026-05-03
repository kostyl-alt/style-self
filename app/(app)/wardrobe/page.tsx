import { redirect } from "next/navigation";

export default function WardrobeRedirect() {
  redirect("/outfit?tab=closet");
}
