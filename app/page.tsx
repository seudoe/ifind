import { redirect } from "next/navigation";

// / → /user  (same page, canonical URL is /user)
export default function RootPage() {
  redirect("/user");
}
