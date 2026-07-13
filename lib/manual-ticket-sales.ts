export const NIJMEGEN_SHOW_SLUG = "nijmegen-2026";
export const MANUAL_TICKET_CAMPAIGN_START_DATE = "2026-06-15";

export type ManualTicketSnapshotInput = {
  snapshotDate: Date;
  cumulativeTickets: number;
};

export type EstimatedDailyTicketSalesPoint = {
  date: string;
  label: string;
  ticketSales: number;
  ticketRevenue: number;
  estimated: true;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDateKey(value));
}

export function buildEstimatedDailyTicketSales(
  snapshots: ManualTicketSnapshotInput[],
  ticketPrice: number
): EstimatedDailyTicketSalesPoint[] {
  const orderedSnapshots = [...snapshots].sort(
    (a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime()
  );
  const points: EstimatedDailyTicketSalesPoint[] = [];
  let previousDate = parseDateKey(MANUAL_TICKET_CAMPAIGN_START_DATE);
  let previousTotal = 0;

  for (const snapshot of orderedSnapshots) {
    const snapshotDate = parseDateKey(dateKey(snapshot.snapshotDate));
    const days = Math.round(
      (snapshotDate.getTime() - previousDate.getTime()) / MS_PER_DAY
    );
    const increase = snapshot.cumulativeTickets - previousTotal;

    if (days <= 0 || increase < 0) {
      previousDate = snapshotDate;
      previousTotal = snapshot.cumulativeTickets;
      continue;
    }

    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      const date = new Date(previousDate);
      date.setUTCDate(date.getUTCDate() + dayIndex);
      const ticketSales =
        Math.round((increase * (dayIndex + 1)) / days) -
        Math.round((increase * dayIndex) / days);
      const dateString = dateKey(date);

      points.push({
        date: dateString,
        label: formatLabel(dateString),
        ticketSales,
        ticketRevenue: ticketSales * ticketPrice,
        estimated: true,
      });
    }

    previousDate = snapshotDate;
    previousTotal = snapshot.cumulativeTickets;
  }

  return points;
}

export function getMostRecentMondayDate() {
  const amsterdamDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = parseDateKey(amsterdamDate);
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date;
}
