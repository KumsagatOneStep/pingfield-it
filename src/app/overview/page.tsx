import { redirect } from "next/navigation";

// Old address of the dashboard; it is the home page now.
export default function OverviewRedirect() {
  redirect("/");
}
