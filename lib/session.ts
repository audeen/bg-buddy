import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  name?: string;
}

const fallbackDevSecret = "fallback-dev-secret-change-me-please-32chars-minimum!!";
const password = process.env.SESSION_SECRET ?? fallbackDevSecret;
if (password === fallbackDevSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET muss in Production gesetzt sein.");
}

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
