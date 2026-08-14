import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCostPerTicketFromSpend,
  calculateForecastTickets,
  calculateOutlook,
  calculateProjectedSpend,
  calculateProjectedSpendDetails,
  calculateShowWeeklyMomentum,
} from "./tour-outlook";

const today = new Date("2026-08-14T12:00:00Z");
const showDate = "2026-09-11";

function forecastForShow(
  currentTickets: number,
  capacity: number,
  ticketSales: number
) {
  const weeklyMomentum = calculateShowWeeklyMomentum(
    [{ date: "2026-08-10", ticketSales }],
    today
  );
  return calculateForecastTickets({
    currentTickets,
    capacity,
    weeklyMomentum,
    showDate,
    today,
  });
}

test("outlook thresholds include green, amber, red and grey", () => {
  assert.equal(calculateOutlook(90, 100), "green");
  assert.equal(calculateOutlook(89, 100), "amber");
  assert.equal(calculateOutlook(70, 100), "amber");
  assert.equal(calculateOutlook(69, 100), "red");
  assert.equal(calculateOutlook(null, 100), "grey");
});

test("each show uses only its own recent ticket momentum", () => {
  assert.equal(forecastForShow(20, 200, 28), 48);
  assert.equal(forecastForShow(20, 200, 84), 104);
});

test("combined tour momentum is not applied to every show", () => {
  const firstShowForecast = forecastForShow(20, 200, 28);
  const secondShowForecast = forecastForShow(20, 200, 84);
  const incorrectTourMomentumForecast = forecastForShow(20, 200, 112);

  assert.equal(firstShowForecast, 48);
  assert.equal(secondShowForecast, 104);
  assert.equal(incorrectTourMomentumForecast, 132);
  assert.notEqual(firstShowForecast, incorrectTourMomentumForecast);
  assert.notEqual(secondShowForecast, incorrectTourMomentumForecast);
});

test("different show momentum does not make every forecast hit capacity", () => {
  assert.deepEqual(
    [forecastForShow(20, 100, 28), forecastForShow(20, 100, 84)],
    [48, 100]
  );
});

test("outlook uses the corrected per-show forecast", () => {
  assert.equal(calculateOutlook(forecastForShow(20, 100, 28), 100), "red");
  assert.equal(calculateOutlook(forecastForShow(20, 100, 56), 100), "amber");
  assert.equal(calculateOutlook(forecastForShow(20, 100, 84), 100), "green");
});

test("forecast is capped at capacity", () => {
  assert.equal(
    calculateForecastTickets({
      currentTickets: 80,
      capacity: 100,
      weeklyMomentum: 50,
      showDate: "2026-09-14",
      today,
    }),
    100
  );
});

test("forecast never falls below current sales", () => {
  assert.equal(
    calculateForecastTickets({
      currentTickets: 80,
      capacity: 100,
      weeklyMomentum: -50,
      showDate: "2026-09-14",
      today,
    }),
    80
  );
});

test("past shows receive no additional ticket projection", () => {
  assert.equal(
    calculateForecastTickets({
      currentTickets: 80,
      capacity: 100,
      weeklyMomentum: 50,
      showDate: "2026-08-13",
      today,
    }),
    80
  );
});

test("missing capacity produces no forecast", () => {
  assert.equal(
    calculateForecastTickets({
      currentTickets: 80,
      capacity: null,
      weeklyMomentum: 50,
      showDate: "2026-09-14",
      today,
    }),
    null
  );
});

test("missing show-level ticket history produces no momentum or forecast", () => {
  const momentum = calculateShowWeeklyMomentum([], today);
  assert.equal(momentum, null);
  assert.equal(
    calculateForecastTickets({
      currentTickets: 80,
      capacity: 100,
      weeklyMomentum: momentum,
      showDate: "2026-09-14",
      today,
    }),
    null
  );
});

function projectedSpend(overrides: Partial<Parameters<typeof calculateProjectedSpend>[0]> = {}) {
  return calculateProjectedSpend({
    currentSpend: 100,
    dailyBudget: 5,
    capacity: 200,
    ticketsSold: 100,
    costPerTicket: 10,
    showDate: "2026-08-21",
    today,
    ...overrides,
  });
}

test("Nijmegen-style projection is capped by remaining inventory", () => {
  const details = calculateProjectedSpendDetails({
    currentSpend: 299.18,
    dailyBudget: 5,
    capacity: 180,
    ticketsSold: 158,
    costPerTicket: 1.89,
    showDate: "2026-12-01",
    today,
  });

  assert.equal(details?.remainingInventory, 22);
  assert.equal(details?.inventorySpendCap, 41.58);
  assert.equal(details?.additionalProjectedSpend, 41.58);
  assert.equal(details?.projectedSpend, 340.76);
});

test("time-based spend is retained when below the inventory cap", () => {
  assert.equal(projectedSpend({ dailyBudget: 2 }), 114);
});

test("sold-out and zero-remaining-inventory shows add no projected spend", () => {
  assert.equal(projectedSpend({ capacity: 100, ticketsSold: 100 }), 100);
  assert.equal(projectedSpend({ capacity: 0, ticketsSold: 0 }), 100);
});

test("missing daily budget has no implicit fallback and produces no projection", () => {
  assert.equal(
    projectedSpend({ dailyBudget: null }),
    null
  );
});

test("zero daily budget keeps projected spend equal to current spend", () => {
  assert.equal(projectedSpend({ dailyBudget: 0 }), 100);
});

test("missing Cost per Ticket uses the ordinary time-based projection", () => {
  const details = calculateProjectedSpendDetails({
    currentSpend: 100,
    dailyBudget: 5,
    capacity: 101,
    ticketsSold: 100,
    costPerTicket: null,
    showDate: "2026-08-21",
    today,
  });

  assert.equal(details?.inventorySpendCap, null);
  assert.equal(details?.scheduledFutureSpend, 35);
  assert.equal(details?.projectedSpend, 135);
});

test("past show dates add no projected spend", () => {
  assert.equal(projectedSpend({ showDate: "2026-08-13" }), 100);
});

test("projected spend never falls below actual spend", () => {
  assert.equal(projectedSpend({ dailyBudget: -5 }), 100);
  assert.equal(projectedSpend({ capacity: 50, ticketsSold: 100 }), 100);
});

test("separate shows use their own explicitly saved daily budgets", () => {
  assert.equal(
    projectedSpend({
      dailyBudget: 2,
    }),
    114
  );
  assert.equal(
    projectedSpend({
      dailyBudget: 7,
    }),
    149
  );
});

test("daily budgets do not change actual Meta spend or Cost per Ticket", () => {
  const actualMetaSpend = 299.34;
  const campaignTickets = 52;

  calculateProjectedSpend({
    currentSpend: actualMetaSpend,
    dailyBudget: 5,
    capacity: 200,
    ticketsSold: 52,
    costPerTicket: actualMetaSpend / campaignTickets,
    showDate: "2026-08-21",
    today,
  });

  assert.equal(actualMetaSpend, 299.34);
  assert.equal(
    calculateCostPerTicketFromSpend(actualMetaSpend, campaignTickets),
    actualMetaSpend / campaignTickets
  );
});
