import { cache } from "react";
import { getSession } from "./session";
import { prisma } from "./prisma";

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  return user;
});

/**
 * Admins werden über die Env-Variable ADMIN_USERS bestimmt
 * (kommagetrennte Nutzernamen, z. B. ADMIN_USERS="Jannik,Anna").
 */
export function isAdmin(user: { name: string } | null): boolean {
  if (!user) return false;
  const adminNames = (process.env.ADMIN_USERS ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return adminNames.includes(user.name);
}
