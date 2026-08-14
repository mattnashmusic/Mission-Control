export type TicketHistoryPoint = {
  date: string;
  ticketSales: number;
};

export type OutlookStatus = "green" | "amber" | "red" | "grey";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function calculateTourWeeklyMomentum(
  history: TicketHistoryPoint[],
  today: Date
): number | null {
  if (history.length === 0) return null;

  const end = utcDateKey(today);
  const startDate = new Date(`${end}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 27);
  const start = utcDateKey(startDate);
  const pointsInWindow = history.filter(
    (point) => point.date >= start && point.date <= end
  );

  if (pointsInWindow.length === 0) return null;

  const fourWeekIncrease = pointsInWindow.reduce(
    (total, point) => total + Math.max(0, point.ticketSales),
    0
  );
  return fourWeekIncrease / 4;
}

export function calculateDaysUntilShow(showDate: string, today: Date): number {
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const show = new Date(showDate);
  const showUtc = Date.UTC(
    show.getUTCFullYear(),
    show.getUTCMonth(),
    show.getUTCDate()
  );
  return Math.max(0, Math.ceil((showUtc - todayUtc) / DAY_MS));
}

export function calculateForecastTickets({
  currentTickets,
  capacity,
  weeklyMomentum,
  showDate,
  today,
}: {
  currentTickets: number;
  capacity: number | null;
  weeklyMomentum: number | null;
  showDate: string;
  today: Date;
}): number | null {
  if (capacity === null || capacity <= 0 || weeklyMomentum === null) return null;
  const daysRemaining = calculateDaysUntilShow(showDate, today);
  if (daysRemaining === 0) return Math.min(currentTickets, capacity);

  const projected = currentTickets + weeklyMomentum * (daysRemaining / 7);
  return Math.min(capacity, Math.max(currentTickets, Math.round(projected)));
}

export function calculateOutlook(
  forecastTickets: number | null,
  capacity: number | null
): OutlookStatus {
  if (forecastTickets === null || capacity === null || capacity <= 0) return "grey";
  const forecastPercent = (forecastTickets / capacity) * 100;
  if (forecastPercent >= 90) return "green";
  if (forecastPercent >= 70) return "amber";
  return "red";
}

export function calculateProjectedSpend({
  currentSpend,
  dailyBudget,
  showDate,
  today,
}: {
  currentSpend: number;
  dailyBudget: number | null;
  showDate: string;
  today: Date;
}): number | null {
  if (dailyBudget === null) return null;
  return currentSpend + dailyBudget * calculateDaysUntilShow(showDate, today);
}
