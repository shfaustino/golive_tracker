sap.ui.define([], function () {
    "use strict";

    /**
     * Statuses that count as "not started" on the KPI row. Postponed has not
     * started either: it is planned again for later.
     */
    var NOT_STARTED = ["Planned", "Postponed"];

    /**
     * Percentage of a part over a total, rounded, 0 when there is no total.
     * @param {number} iPart the part
     * @param {number} iTotal the total
     * @returns {number} 0 to 100
     */
    function percent(iPart, iTotal) {
        return iTotal ? Math.round(iPart * 100 / iTotal) : 0;
    }

    return {

        /**
         * The KPI row above a project's milestones
         * (docs/mockups/04-projeto-marcos.png). Not applicable and cancelled
         * milestones are left out of the total: nothing is expected of them.
         * Overdue is the API's own isOverdue (BR-07), whatever the status.
         * @param {object[]} aMilestones the milestones, as the API answers them
         * @returns {{total: number, completed: number, completedPct: number,
         *   inProgress: number, inProgressPct: number, overdue: number,
         *   overduePct: number, notStarted: number, notStartedPct: number}} the counts
         */
        summarise: function (aMilestones) {
            var aCounted = aMilestones.filter(function (oMilestone) {
                    return oMilestone.status !== "NotApplicable" && oMilestone.status !== "Cancelled";
                }),
                iTotal = aCounted.length,
                count = function (fnTest) {
                    return aCounted.filter(fnTest).length;
                },
                iCompleted = count(function (o) {
                    return o.status === "Completed";
                }),
                iInProgress = count(function (o) {
                    return o.status === "InProgress";
                }),
                iOverdue = count(function (o) {
                    return o.isOverdue === true;
                }),
                iNotStarted = count(function (o) {
                    return NOT_STARTED.indexOf(o.status) !== -1;
                });

            return {
                total: iTotal,
                completed: iCompleted,
                completedPct: percent(iCompleted, iTotal),
                inProgress: iInProgress,
                inProgressPct: percent(iInProgress, iTotal),
                overdue: iOverdue,
                overduePct: percent(iOverdue, iTotal),
                notStarted: iNotStarted,
                notStartedPct: percent(iNotStarted, iTotal)
            };
        },

        /**
         * What an edit of a milestone sends: only the fields that changed
         * (PATCH carries only what changed), plus the rules the API enforces,
         * checked here first so the user sees them next to the field.
         *
         * - changing forecastStart or forecastEnd needs a changeReason;
         * - Completed needs an actualDate;
         * - NotApplicable needs a justification.
         *
         * @param {object} oBefore the milestone as read
         * @param {object} oAfter the dialog's values
         * @returns {{changes: object, errors: Object<string, string>}} the
         *   fields to send, and per field the i18n key of what is missing
         */
        editChanges: function (oBefore, oAfter) {
            var aFields = ["forecastStart", "forecastEnd", "status", "actualDate", "justification"],
                oChanges = {},
                oErrors = {},
                bDatesChanged;

            aFields.forEach(function (sField) {
                var vBefore = oBefore[sField] || null,
                    vAfter = oAfter[sField] || null;

                if (vBefore !== vAfter) {
                    oChanges[sField] = vAfter;
                }
            });

            bDatesChanged = "forecastStart" in oChanges || "forecastEnd" in oChanges;
            if (bDatesChanged) {
                if ((oAfter.changeReason || "").trim()) {
                    oChanges.changeReason = oAfter.changeReason.trim();
                } else {
                    oErrors.changeReason = "msErrorChangeReason";
                }
            }
            if (oAfter.status === "Completed" && !oAfter.actualDate) {
                oErrors.actualDate = "msErrorActualDate";
            }
            if (oAfter.status === "NotApplicable" && !(oAfter.justification || "").trim()) {
                oErrors.justification = "msErrorJustification";
            }
            if (oAfter.forecastStart && oAfter.forecastEnd && oAfter.forecastEnd < oAfter.forecastStart) {
                oErrors.forecastEnd = "msErrorEndBeforeStart";
            }

            return { changes: oChanges, errors: oErrors };
        }
    };
});
