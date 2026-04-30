import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeEmail(email: string | null) {
  return email?.trim().toLowerCase() || "";
}

function isFSHProduct(title: string) {
  const t = title.toLowerCase();

  return (
    t.includes("rebirth") ||
    t.includes("deluxe") ||
    t.includes("vinyl")
  );
}

export async function GET() {
  try {
    const tourVotes = await prisma.tourVote.findMany({
      select: { email: true },
    });

    const totalTourVotes = tourVotes.length;

    const orders = await prisma.shopifyOrder.findMany({
      select: {
        email: true,
        lineItems: {
          select: { title: true },
        },
      },
    });

    const fshEmailSet = new Set<string>();

    for (const order of orders) {
      const email = normalizeEmail(order.email);
      if (!email) continue;

      const hasFsh = order.lineItems.some((item) =>
        isFSHProduct(item.title)
      );

      if (hasFsh) fshEmailSet.add(email);
    }

    let fshCount = 0;

    for (const vote of tourVotes) {
      const email = normalizeEmail(vote.email);
      if (fshEmailSet.has(email)) fshCount++;
    }

    const nonFsh = totalTourVotes - fshCount;

    return NextResponse.json(
      {
        total: totalTourVotes,
        fsh: fshCount,
        nonFsh,
        percentNew: Number(((nonFsh / totalTourVotes) * 100).toFixed(1)),
        percentFsh: Number(((fshCount / totalTourVotes) * 100).toFixed(1)),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
