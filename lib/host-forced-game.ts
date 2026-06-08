import type { PrismaClient } from "@prisma/client";

export type HostForcedGameInfo = {
  gameId: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
};

export async function loadHostForcedGame(
  meetupId: string,
  db: PrismaClient,
): Promise<HostForcedGameInfo | null> {
  const meetup = await db.meetup.findUnique({
    where: { id: meetupId },
    select: {
      hostForcedGameId: true,
      hostForcedGame: {
        select: {
          id: true,
          name: true,
          thumbnail: true,
          image: true,
        },
      },
    },
  });
  if (!meetup?.hostForcedGameId || !meetup.hostForcedGame) return null;
  return {
    gameId: meetup.hostForcedGame.id,
    name: meetup.hostForcedGame.name,
    thumbnail: meetup.hostForcedGame.thumbnail,
    image: meetup.hostForcedGame.image,
  };
}

export function isHostForcedMeetup(hostForcedGameId: number | null | undefined) {
  return hostForcedGameId != null;
}
