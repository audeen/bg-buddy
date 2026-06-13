import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { id: true },
  });
  return NextResponse.json({ exists: meetup !== null });
}
