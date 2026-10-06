"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const monthChart = require("./loadUi5Module")("model/monthChart.js");

const NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

test("niceTop rounds the axis up to a round number", () => {
    assert.equal(monthChart.niceTop(0), 5);
    assert.equal(monthChart.niceTop(3), 5);
    assert.equal(monthChart.niceTop(12), 15);
    assert.equal(monthChart.niceTop(22), 25);
    assert.equal(monthChart.niceTop(60), 75);
    assert.equal(monthChart.niceTop(130), 150);
});

test("describe orders the months and scales the bars to the axis", () => {
    const oChart = monthChart.describe([
        { month: "2026-07", created: 15, closed: 7 },
        { month: "2026-06", created: 10, closed: 5 }
    ], NAMES);

    assert.equal(oChart.top, 15);
    assert.deepEqual(oChart.ticks, [0, 3, 6, 9, 12, 15]);
    assert.deepEqual(oChart.months.map((m) => [m.label, m.createdPct, m.closedPct]), [["Jun", 67, 33], ["Jul", 100, 47]]);
});

test("describe of no data is an empty chart on a 0-5 axis", () => {
    const oChart = monthChart.describe([], NAMES);

    assert.equal(oChart.top, 5);
    assert.deepEqual(oChart.months, []);
});
