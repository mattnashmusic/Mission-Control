import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateForecastTickets,
  calculateOutlook,
  calculateProjectedSpend,
  calculateTourWeeklyMomentum,
} from "./tour-outlook";

const today = new Date("2026-08-14T12:00:00Z");

test("outlook thresholds include green, amber, red and grey", () => {
  assert.equal(calculateOutlook(90, 100), "green");
  assert.equal(calculateOutlook(89, 100), "amber");
  assert.equal(calculateOutlook(70, 100), "amber");
  assert.equal(calculateOutlook(69, 100), "red");
  assert.equal(calculateOutlook(null, 100), "grey");
});

test("forecast is capped at capacity", () => {
  assert.equal(calculateForecastTickets({ currentTickets: 80, capacity: 100, weeklyMomentum: 50, showDate: "2026-09-14", today }), 100);
});

test("forecast never falls below current sales", () => {
  assert.equal(calculateForecastTickets({ currentTickets: 80, capacity: 100, weeklyMomentum: -50, showDate: "2026-09-14", today }), 80);
});

test("past shows receive no additional ticket projection", () => {
  assert.equal(calculateForecastTickets({ currentTickets: 80, capacity: 100, weeklyMomentum: 50, showDate: "2026-08-13", today }), 80);
});

test("missing capacity produces no forecast", () => {
  assert.equal(calculateForecastTickets({ currentTickets: 80, capacity: null, weeklyMomentum: 50, showDate: "2026-09-14", today }), null);
});

test("missing ticket history produces no momentum or forecast", () => {
  const momentum = calculateTourWeeklyMomentum([], today);
  assert.equal(momentum, null);
  assert.equal(calculateForecastTickets({ currentTickets: 80, capacity: 100, weeklyMomentum: momentum, showDate: "2026-09-14", today }), null);
});

test("missing daily budget produces no projected spend", () => {
  assert.equal(calculateProjectedSpend({ currentSpend: 100, dailyBudget: null, showDate: "2026-08-21", today }), null);
});

test("zero daily budget keeps projected spend equal to current spend", () => {
  assert.equal(calculateProjectedSpend({ currentSpend: 100, dailyBudget: 0, showDate: "2026-08-21", today }), 100);
});
