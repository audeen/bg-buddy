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
