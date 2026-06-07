import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupBarcode, normalizeBarcode } from "@/lib/barcode-lookup";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: { barcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const raw = String(body.barcode ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "Barcode fehlt." }, { status: 400 });
  }

  const normalized = normalizeBarcode(raw);
  if (normalized) {
    const byBarcode = await prisma.game.findUnique({
      where: { barcode: normalized },
      select: { id: true, name: true },
    });
    if (byBarcode) {
      return NextResponse.json({
        status: "alreadyInCollection",
        bggId: byBarcode.id,
        name: byBarcode.name,
        barcode: normalized,
      });
    }
  }

  const result = await lookupBarcode(raw);
  return NextResponse.json(result);
}
