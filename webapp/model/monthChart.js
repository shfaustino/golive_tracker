sap.ui.define([], function () {
    "use strict";

    /**
     * A "nice" top for the axis: the smallest of 5, 10, 15, 20, 25, 50, 75,
     * 100, ... that is at least the largest value, so the gridlines fall on
     * round numbers.
     * @param {number} iMax the largest value
     * @returns {number} the axis top
     */
    function niceTop(iMax) {
        var aSteps = [1, 1.5, 2, 2.5, 5, 7.5, 10],
            iScale = 1,
            i;

        if (iMax <= 5) {
            return 5;
        }
        while (iScale * 10 < iMax) {
            iScale *= 10;
        }
        for (i = 0; i < aSteps.length; i += 1) {
            if (aSteps[i] * iScale >= iMax) {
                return aSteps[i] * iScale;
            }
        }
        return 10 * iScale;
    }

    return {

        niceTop: niceTop,

        /**
         * "Evolução dos projetos" (docs/mockups/02-dashboard.png), from
         * dashboard().projectsByMonth: per month, the projects started and
         * the projects closed, as bar heights in percent of the axis.
         * @param {{month: string, created: number, closed: number}[]} aByMonth "YYYY-MM" rows
         * @param {string[]} aMonthNames twelve short month names, January first
         * @returns {{top: number, ticks: number[], months: {label: string, created: number,
         *   closed: number, createdPct: number, closedPct: number}[]}} the chart
         */
        describe: function (aByMonth, aMonthNames) {
            var aRows = (aByMonth || []).slice().sort(function (a, b) {
                    return a.month.localeCompare(b.month);
                }),
                iMax = aRows.reduce(function (iTop, oRow) {
                    return Math.max(iTop, oRow.created || 0, oRow.closed || 0);
                }, 0),
                iTop = niceTop(iMax),
                aTicks = [0, 1, 2, 3, 4, 5].map(function (i) {
                    return Math.round(iTop * i / 5 * 10) / 10;
                });

            return {
                top: iTop,
                ticks: aTicks,
                months: aRows.map(function (oRow) {
                    var iMonth = Number(oRow.month.slice(5, 7));

                    return {
                        label: aMonthNames[iMonth - 1] || oRow.month,
                        created: oRow.created || 0,
                        closed: oRow.closed || 0,
                        createdPct: Math.round((oRow.created || 0) * 100 / iTop),
                        closedPct: Math.round((oRow.closed || 0) * 100 / iTop)
                    };
                })
            };
        }
    };
});
