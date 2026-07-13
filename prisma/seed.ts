import { prisma } from "../lib/prisma";

async function main() {
  await prisma.tourSettings.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      plannedAdBudget: 12000,
      blendedCpt: 8,
    },
  });

  const shows = [
    {
      slug: "hamburg-2026",
      date: new Date("2026-11-20"),
      city: "Hamburg",
      country: "DE",
      venue: "Monkeys Music Club",
      notes: "Fri or Sat",
      capacity: 350,
      ticketPrice: 22,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 1600,
      production: 500,
      hotelPetrolMisc: 250,
    },
    {
      slug: "berlin-2026",
      date: new Date("2026-11-22"),
      city: "Berlin",
      country: "DE",
      venue: "Badehaus",
      notes: "Sun",
      capacity: 200,
      ticketPrice: 22,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 725,
      production: 500,
      hotelPetrolMisc: 250,
    },
    {
      slug: "munich-2026",
      date: new Date("2026-11-23"),
      city: "Munich",
      country: "DE",
      venue: "Fierwerk / Orangehaus",
      notes: "Mon",
      capacity: 200,
      ticketPrice: 22,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 875,
      production: 500,
      hotelPetrolMisc: 250,
    },
    {
      slug: "zurich-2026",
      date: new Date("2026-11-24"),
      city: "Zurich",
      country: "CH",
      venue: "Xtra Cafe",
      notes: "Tues",
      capacity: 140,
      ticketPrice: 25,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 240,
      production: 500,
      hotelPetrolMisc: 250,
    },
    {
      slug: "cologne-2026",
      date: new Date("2026-11-26"),
      city: "Cologne",
      country: "DE",
      venue: "Yuca",
      notes: "Thurs",
      capacity: 270,
      ticketPrice: 22,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 1204,
      production: 500,
      hotelPetrolMisc: 250,
    },
    {
      slug: "brussels-2026",
      date: new Date("2026-11-27"),
      city: "Brussels",
      country: "BE",
      venue: "Pilar",
      notes: "Fri or Sat both Reserved",
      capacity: 300,
      ticketPrice: 22,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 1385,
      production: 500,
      hotelPetrolMisc: 250,
    },
    {
      slug: "nijmegen-2026",
      date: new Date("2026-12-01"),
      city: "Nijmegen",
      country: "NL",
      venue: "Merleyn",
      notes: "Tuesday",
      capacity: 180,
      ticketPrice: 20,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 0,
      production: 0,
      hotelPetrolMisc: 150,
    },
    {
      slug: "amsterdam-2026",
      date: new Date("2026-12-04"),
      city: "Amsterdam",
      country: "NL",
      venue: "Toekomst",
      notes: "Thurs",
      capacity: 350,
      ticketPrice: 22,
      ticketSales: 0,
      metaSpend: 0,
      venueHire: 500,
      production: 500,
      hotelPetrolMisc: 0,
    },
  ];

  for (const show of shows) {
    await prisma.show.upsert({
      where: { slug: show.slug },
      update: show,
      create: show,
    });
  }

  const nijmegen = await prisma.show.findUnique({
    where: { slug: "nijmegen-2026" },
  });

  if (nijmegen) {
    const snapshots = [
      { snapshotDate: new Date("2026-06-22"), cumulativeTickets: 36 },
      { snapshotDate: new Date("2026-06-29"), cumulativeTickets: 56 },
      { snapshotDate: new Date("2026-07-06"), cumulativeTickets: 74 },
      { snapshotDate: new Date("2026-07-13"), cumulativeTickets: 90 },
    ];

    for (const snapshot of snapshots) {
      await prisma.manualTicketSnapshot.upsert({
        where: {
          showId_snapshotDate: {
            showId: nijmegen.id,
            snapshotDate: snapshot.snapshotDate,
          },
        },
        update: { cumulativeTickets: snapshot.cumulativeTickets },
        create: {
          showId: nijmegen.id,
          ...snapshot,
        },
      });
    }

    await prisma.show.update({
      where: { id: nijmegen.id },
      data: { ticketSales: 90 },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
