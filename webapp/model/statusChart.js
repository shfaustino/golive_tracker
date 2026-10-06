sap.ui.define([], function () {
    "use strict";

    /**
     * The order and colour of each project status in "Projetos por estado"
     * (docs/mockups/02-dashboard.png): the open ones first, in blues and
     * orange, then the finished ones.
     */
    var STATUSES = [
        { status: "InProgress", color: "#1463f3" },
        { status: "NotStarted", color: "#9cc2ff" },
        { status: "OnHold", color: "#f5a524" },
        { status: "Replanning", color: "#ffc978" },
        { status: "Closing", color: "#5ec7b4" },
        { status: "Closed", color: "#3bb273" },
        { status: "Cancelled", color: "#ef5b67" }
    ];
    var OTHER_COLOR = "#a9b4c6",
        EMPTY_COLOR = "#eef1f5";

    /**
     * Rounds to one decimal, as the legend shows it ("31,8%").
     * @param {number} n the number
     * @returns {number} rounded
     */
    function oneDecimal(n) {
        return Math.round(n * 10) / 10;
    }

    return {

        /**
         * The donut and its legend, from dashboard().projectsByStatus.
         * Statuses with no projects are left out; one the app does not know
         * (a newer API version) is still counted, in grey.
         * @param {{status: string, count: number}[]} aByStatus the API's counts
         * @returns {{total: number, rows: {status: string, count: number, pct: number, color: string}[],
         *   gradient: string}} the rows in display order, and the CSS conic-gradient that draws them
         */
        describe: function (aByStatus) {
            var mCounts = {},
                aRows = [],
                iTotal = 0,
                fFrom = 0,
                aStops = [];

            (aByStatus || []).forEach(function (oRow) {
                mCounts[oRow.status] = (mCounts[oRow.status] || 0) + (oRow.count || 0);
                iTotal += oRow.count || 0;
            });
            STATUSES.forEach(function (oStatus) {
                if (mCounts[oStatus.status]) {
                    aRows.push({ status: oStatus.status, count: mCounts[oStatus.status], color: oStatus.color });
                    delete mCounts[oStatus.status];
                }
            });
            Object.keys(mCounts).forEach(function (sStatus) {
                if (mCounts[sStatus]) {
                    aRows.push({ status: sStatus, count: mCounts[sStatus], color: OTHER_COLOR });
                }
            });

            aRows.forEach(function (oRow) {
                var fTo = fFrom + oRow.count * 100 / iTotal;

                oRow.pct = oneDecimal(oRow.count * 100 / iTotal);
                aStops.push(oRow.color + " " + oneDecimal(fFrom) + "% " + oneDecimal(fTo) + "%");
                fFrom = fTo;
            });

            return {
                total: iTotal,
                rows: aRows,
                gradient: aStops.length ? "conic-gradient(" + aStops.join(", ") + ")" : "conic-gradient(" + EMPTY_COLOR + " 0% 100%)"
            };
        }
    };
});
