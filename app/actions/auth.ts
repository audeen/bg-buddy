"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Bitte gib einen Namen ein." };
  }
  if (name.length > 40) {
    return { error: "Name ist zu lang (max. 40 Zeichen)." };
  }

  const user = await prisma.user.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  await session.save();

  redirect("/");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
