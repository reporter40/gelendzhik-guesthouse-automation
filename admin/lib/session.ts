import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  type SessionData,
  getIronSessionOptions,
} from "@/lib/session-config";

export type { SessionData } from "@/lib/session-config";

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getIronSessionOptions());
}

export async function requireAuth(): Promise<void> {
  const session = await getSession();
  if (session.authenticated !== true) {
    redirect("/login");
  }
}
