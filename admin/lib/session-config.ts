import type { SessionOptions } from "iron-session";

import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export interface SessionData {
  authenticated?: boolean;
}

function getSessionPassword(): string {
  const p = process.env.SESSION_PASSWORD ?? process.env.SESSION_SECRET;
  if (!p || p.length < 32) {
    throw new Error(
      "SESSION_PASSWORD (or SESSION_SECRET) must be set and at least 32 characters",
    );
  }
  return p;
}

export function getIronSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: ADMIN_SESSION_COOKIE_NAME,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    },
  };
}
