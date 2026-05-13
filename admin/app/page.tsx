import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export default async function Home() {
  const jar = await cookies();
  const v = jar.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const loggedIn = typeof v === "string" && v.length > 0;

  redirect(loggedIn ? "/bookings" : "/login");
}
