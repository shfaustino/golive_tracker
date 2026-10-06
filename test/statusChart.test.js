"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const statusChart = require("./loadUi5Module")("model/statusChart.js");

test("describe orders the statuses and works out their share", () => {
    const oChart = statusChart.describe([
        { status: "Closed", count: 1 },
        { status: "InProgress", count: 3 }
    ]);

    assert.equal(oChart.total, 4);
    assert.deepEqual(oChart.rows.map((r) => [r.status, r.count, r.pct]), [["InProgress", 3, 75], ["Closed", 1, 25]]);
    assert.equal(oChart.gradient, "conic-gradient(#1463f3 0% 75%, #3bb273 75% 100%)");
});

test("describe keeps a status it does not know, in grey, at the end", () => {
    const oChart = statusChart.describe([{ status: "Archived", count: 1 }, { status: "OnHold", count: 1 }]);

    assert.deepEqual(oChart.rows.map((r) => r.status), ["OnHold", "Archived"]);
    assert.equal(oChart.rows[1].color, "#a9b4c6");
});

test("describe of nothing draws an empty ring", () => {
    const oChart = statusChart.describe([]);

    assert.equal(oChart.total, 0);
    assert.deepEqual(oChart.rows, []);
    assert.match(oChart.gradient, /^conic-gradient\(#eef1f5/);
});
