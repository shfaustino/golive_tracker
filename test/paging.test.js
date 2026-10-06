"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const paging = require("./loadUi5Module")("model/paging.js");

test("describe gives the range text's numbers and the page buttons", () => {
    const oPage = paging.describe(1, 10, 24);

    assert.equal(oPage.from, 1);
    assert.equal(oPage.to, 10);
    assert.equal(oPage.pageCount, 3);
    assert.deepEqual(oPage.pages.map((p) => p.n), [1, 2, 3]);
    assert.equal(oPage.pages[0].current, true);
});

test("describe of the last page ends at the total", () => {
    const oPage = paging.describe(3, 10, 24);

    assert.equal(oPage.from, 21);
    assert.equal(oPage.to, 24);
});

test("describe keeps a page past the end on the last page", () => {
    assert.equal(paging.describe(9, 10, 24).page, 3);
});

test("describe shows at most five page numbers, around the current one", () => {
    assert.deepEqual(paging.describe(10, 10, 200).pages.map((p) => p.n), [8, 9, 10, 11, 12]);
    assert.deepEqual(paging.describe(20, 10, 200).pages.map((p) => p.n), [16, 17, 18, 19, 20]);
});

test("describe of nothing has no pages to step through", () => {
    const oPage = paging.describe(1, 10, 0);

    assert.equal(oPage.pageCount, 0);
    assert.equal(oPage.from, 0);
    assert.equal(oPage.to, 0);
});
