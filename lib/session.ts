import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  name?: string;
}

const password =
  process.env.SESSION_SECRET ??
  "fallback-dev-secret-change-me-please-32chars-minimum!!";

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "bgbuddy_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
