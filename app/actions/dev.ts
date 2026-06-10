"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  completeDummyDuelsForMeetup,
  countDummyMeetups,
  createAllDummyMeetups,
  purgeDummyMeetups,
} from "@/lib/dummy-meetups";

export async function countDummyMeetupsAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const count = await countDummyMeetups();
  return { ok: true, count };
}

export async function createDummyMeetupsAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  try {
    const { count } = await createAllDummyMeetups(user.id);
    revalidatePath("/");
    return { ok: true, count };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dummy-Treffen konnten nicht erstellt werden.";
    return { error: message };
  }
}

export async function purgeDummyMeetupsAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const deleted = await purgeDummyMeetups();

  revalidatePath("/");

  return { ok: true, deleted };
}

export async function completeDummyDuelsAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const result = await completeDummyDuelsForMeetup(meetupId);
  if ("error" in result) return { error: result.error };

  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
  revalidatePath("/");

  return { ok: true, votesAdded: result.votesAdded };
}
