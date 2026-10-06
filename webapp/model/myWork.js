sap.ui.define([], function () {
    "use strict";

    var OPEN = ["ToDo", "InProgress"],
        DAY_MS = 86400000;

    /**
     * Whether an item is late: still open and its date has passed. The API's
     * own isOverdue wins when it sends one.
     * @param {object} oItem an item of MyItems
     * @param {string} sToday YYYY-MM-DD
     * @returns {boolean} late
     */
    function isLate(oItem, sToday) {
        if (typeof oItem.isOverdue === "boolean") {
            return oItem.isOverdue;
        }
        return OPEN.indexOf(oItem.status) !== -1 && !!oItem.date && oItem.date < sToday;
    }

    /**
     * Whole days from one YYYY-MM-DD to another.
     * @param {string} sFrom YYYY-MM-DD
     * @param {string} sTo YYYY-MM-DD
     * @returns {number} days, positive when sTo is later
     */
    function days(sFrom, sTo) {
        return Math.round((Date.parse(sTo + "T00:00:00Z") - Date.parse(sFrom + "T00:00:00Z")) / DAY_MS);
    }

    return {

        isLate: isLate,

        /**
         * Everything O meu trabalho shows about the signed-in person's items
         * (docs/mockups/07-o-meu-trabalho.png): the KPI row, the late ones,
         * and the next ones due.
         * @param {object[]} aItems MyItems
         * @param {string} sToday YYYY-MM-DD
         * @param {number} [iUpcoming] how many upcoming items, 5 by default
         * @returns {{items: object[], kpi: {total: number, inProgress: number, late: number, done: number},
         *   late: object[], upcoming: object[]}} items with a late flag;
         *   late ones oldest first with daysLate; upcoming ones soonest first
         */
        describe: function (aItems, sToday, iUpcoming) {
            var aMarked = (aItems || []).map(function (oItem) {
                    return Object.assign({}, oItem, { late: isLate(oItem, sToday) });
                }),
                aLate = aMarked.filter(function (oItem) {
                    return oItem.late;
                }).map(function (oItem) {
                    return Object.assign({}, oItem, { daysLate: oItem.date ? days(oItem.date, sToday) : 0 });
                }).sort(function (a, b) {
                    return b.daysLate - a.daysLate;
                }),
                aUpcoming = aMarked.filter(function (oItem) {
                    return !oItem.late && OPEN.indexOf(oItem.status) !== -1 && oItem.date && oItem.date >= sToday;
                }).sort(function (a, b) {
                    return a.date.localeCompare(b.date);
                }).slice(0, iUpcoming || 5);

            return {
                items: aMarked,
                kpi: {
                    total: aMarked.length,
                    inProgress: aMarked.filter(function (o) {
                        return o.status === "InProgress";
                    }).length,
                    late: aLate.length,
                    done: aMarked.filter(function (o) {
                        return o.status === "Done";
                    }).length
                },
                late: aLate,
                upcoming: aUpcoming
            };
        },

        /**
         * The items the table shows: those matching the text (task, project
         * code or name) and the state picked. "Late" is a state of its own.
         * @param {object[]} aItems items as describe returns them
         * @param {string} sTerm text typed, any case
         * @param {string} sState "" for all, "Late", or a status
         * @returns {object[]} the matching items
         */
        filter: function (aItems, sTerm, sState) {
            var sNeedle = (sTerm || "").trim().toLowerCase();

            return aItems.filter(function (oItem) {
                var bText = !sNeedle || [oItem.name, oItem.projectCode, oItem.projectName].some(function (s) {
                        return (s || "").toLowerCase().indexOf(sNeedle) !== -1;
                    }),
                    bState = !sState || (sState === "Late" ? oItem.late : oItem.status === sState && !oItem.late);

                return bText && bState;
            });
        }
    };
});
