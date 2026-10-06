sap.ui.define([], function () {
    "use strict";

    var DAY_MS = 86400000,
        DONE = ["Completed"],
        SKIPPED = ["NotApplicable", "Cancelled"];

    /**
     * Whole days from one YYYY-MM-DD to another (positive when b is later).
     * @param {string} sFrom YYYY-MM-DD
     * @param {string} sTo YYYY-MM-DD
     * @returns {number} days
     */
    function daysBetween(sFrom, sTo) {
        return Math.round((Date.parse(sTo + "T00:00:00Z") - Date.parse(sFrom + "T00:00:00Z")) / DAY_MS);
    }

    return {

        daysBetween: daysBetween,

        /**
         * What Visão geral shows about the milestones: how far the project
         * is, a timeline of its milestones, and the next one due.
         *
         * Not applicable and cancelled milestones count for nothing and stay
         * off the timeline. Each step on the timeline is "done", "late"
         * (isOverdue, BR-07), "current" (the first open one) or "todo".
         *
         * @param {object[]} aMilestones the project's milestones, in sortOrder
         * @param {string} sToday today, YYYY-MM-DD
         * @returns {{total: number, done: number, pct: number,
         *   steps: {ID: string, milestoneType: string, date: string, status: string, step: string}[],
         *   next: ({ID: string, milestoneType: string, date: string, days: number, overdue: boolean}|null)}}
         */
        describe: function (aMilestones, sToday) {
            var aCounted = (aMilestones || []).filter(function (oMilestone) {
                    return SKIPPED.indexOf(oMilestone.status) === -1;
                }),
                iDone = aCounted.filter(function (oMilestone) {
                    return DONE.indexOf(oMilestone.status) !== -1;
                }).length,
                bCurrentSet = false,
                oNext = null,
                aSteps = aCounted.map(function (oMilestone) {
                    var sStep;

                    if (DONE.indexOf(oMilestone.status) !== -1) {
                        sStep = "done";
                    } else if (oMilestone.isOverdue) {
                        sStep = "late";
                    } else if (!bCurrentSet) {
                        sStep = "current";
                        bCurrentSet = true;
                    } else {
                        sStep = "todo";
                    }
                    // The next milestone is the first one not done, late or not.
                    if (sStep !== "done" && !oNext) {
                        oNext = {
                            ID: oMilestone.ID,
                            milestoneType: oMilestone.milestoneType,
                            date: oMilestone.forecastEnd,
                            days: oMilestone.forecastEnd ? daysBetween(sToday, oMilestone.forecastEnd) : null,
                            overdue: !!oMilestone.isOverdue
                        };
                    }
                    return {
                        ID: oMilestone.ID,
                        milestoneType: oMilestone.milestoneType,
                        date: oMilestone.actualDate || oMilestone.forecastEnd,
                        status: oMilestone.status,
                        step: sStep
                    };
                });

            return {
                total: aCounted.length,
                done: iDone,
                pct: aCounted.length ? Math.round(iDone * 100 / aCounted.length) : 0,
                steps: aSteps,
                next: oNext
            };
        }
    };
});
