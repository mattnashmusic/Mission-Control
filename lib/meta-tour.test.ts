import assert from "node:assert/strict";
import test from "node:test";
import {
  convertMetaDailyBudget,
  deriveTourMetaBudget,
  resolveTourDailyBudget,
} from "./meta-tour";
import {
  calculateCostPerTicketFromSpend,
  calculateProjectedSpendDetails,
} from "./tour-outlook";

const campaign = {
  id: "campaign-1",
  status: "ACTIVE",
  effective_status: "ACTIVE",
  is_adset_budget_sharing_enabled: false,
};

function adSet(
  id: string,
  dailyBudget = "500",
  effectiveStatus = "ACTIVE"
) {
  return {
    id,
    name: `Ad set ${id}`,
    campaign_id: "campaign-1",
    account_id: "account-1",
    status: effectiveStatus,
    configured_status: effectiveStatus,
    effective_status: effectiveStatus,
    daily_budget: dailyBudget,
  };
}

function derive(adSets: ReturnType<typeof adSet>[]) {
  return deriveTourMetaBudget({
    adSets,
    campaignsById: { "campaign-1": campaign },
    accountCurrencyById: { "account-1": "EUR" },
  });
}

test("one active Meta ad set supplies one show's daily budget", () => {
  const result = derive([adSet("one")]);
  assert.equal(result.dailyBudget, 5);
  assert.equal(result.attributable, true);
});

test("multiple active matched ad sets are summed", () => {
  assert.equal(derive([adSet("one", "500"), adSet("two", "300")]).dailyBudget, 8);
});

test("paused ad sets are excluded and produce a genuine Meta zero", () => {
  const result = derive([adSet("paused", "500", "PAUSED")]);
  assert.equal(result.dailyBudget, 0);
  assert.equal(result.attributable, true);
  assert.equal(result.adSets[0].included, false);
});

test("mixed active and paused ad sets include only active budgets", () => {
  assert.equal(
    derive([adSet("active", "500"), adSet("paused", "900", "PAUSED")])
      .dailyBudget,
    5
  );
});

test("separate shows do not leak Meta budgets into each other", () => {
  const firstShow = derive([adSet("first", "500")]);
  const secondShow = derive([adSet("second", "900")]);
  assert.equal(firstShow.dailyBudget, 5);
  assert.equal(secondShow.dailyBudget, 9);
});

test("duplicate Meta ad-set IDs are counted once", () => {
  assert.equal(derive([adSet("same", "500"), adSet("same", "500")]).dailyBudget, 5);
});

test("Meta budget is preferred over a manual fallback", () => {
  const resolved = resolveTourDailyBudget(derive([adSet("one", "800")]), 5);
  assert.equal(resolved.source, "meta");
  assert.equal(resolved.dailyBudget, 8);
});

test("manual budget is used when Meta is unavailable", () => {
  const resolved = resolveTourDailyBudget(null, 5);
  assert.equal(resolved.source, "manual");
  assert.equal(resolved.dailyBudget, 5);
});

test("genuine Meta zero is distinct from unavailable", () => {
  const zero = resolveTourDailyBudget(derive([adSet("zero", "0")]), 5);
  const unavailable = resolveTourDailyBudget(null, null);
  assert.deepEqual([zero.source, zero.dailyBudget], ["meta", 0]);
  assert.deepEqual([unavailable.source, unavailable.dailyBudget], ["unavailable", null]);
});

test("campaign-level budget is not copied onto a show", () => {
  const result = deriveTourMetaBudget({
    adSets: [{ ...adSet("one"), daily_budget: undefined }],
    campaignsById: {
      "campaign-1": {
        ...campaign,
        daily_budget: "5000",
        is_adset_budget_sharing_enabled: true,
      },
    },
    accountCurrencyById: { "account-1": "EUR" },
  });
  assert.equal(result.attributable, false);
  assert.equal(result.dailyBudget, null);
});

test("live EUR Meta budget values are converted from minor units", () => {
  assert.equal(convertMetaDailyBudget("500", "EUR"), 5);
  assert.equal(convertMetaDailyBudget("0", "EUR"), 0);
  assert.equal(convertMetaDailyBudget("500", undefined), null);
});

test("derived budget drives capacity-capped projection without changing actual spend or CPT", () => {
  const actualSpend = 299.18;
  const campaignTickets = 158;
  const costPerTicket = calculateCostPerTicketFromSpend(
    actualSpend,
    campaignTickets
  );
  const resolved = resolveTourDailyBudget(derive([adSet("nijmegen")]), null);
  const projection = calculateProjectedSpendDetails({
    currentSpend: actualSpend,
    dailyBudget: resolved.dailyBudget,
    capacity: 180,
    ticketsSold: 158,
    costPerTicket,
    showDate: "2026-12-01",
    today: new Date("2026-08-14T12:00:00Z"),
  });

  assert.ok(projection);
  assert.equal(actualSpend, 299.18);
  assert.equal(costPerTicket, actualSpend / campaignTickets);
  assert.equal(projection?.projectedSpend >= actualSpend, true);
  assert.equal(
    projection?.additionalProjectedSpend,
    projection?.inventorySpendCap
  );
});
