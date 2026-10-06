sap.ui.define([], function () {
    "use strict";

    /** Milestone statuses that leave a milestone out of the progress. */
    var OUT = ["NotApplicable", "Cancelled"];

    return {

        /**
         * What the Módulos tab shows for each of the project's modules: its
         * milestones (and how many are completed) and the active team
         * members who work on it. Milestones with no module, and members
         * with none, are the whole project's and show under no module.
         * @param {{module: string}[]} aModules the project's modules
         * @param {{module: string, milestoneType: string, status: string}[]} aMilestones the project's milestones
         * @param {{person: {name: string}, role: string, modules: {module: string}[]}[]} aTeam the active team
         * @returns {object[]} per module: module, milestones, msDone, msTotal, team
         */
        describe: function (aModules, aMilestones, aTeam) {
            return (aModules || []).map(function (oModule) {
                var sModule = oModule.module,
                    aOwn = (aMilestones || []).filter(function (oMilestone) {
                        return oMilestone.module === sModule;
                    }),
                    aCounted = aOwn.filter(function (oMilestone) {
                        return OUT.indexOf(oMilestone.status) === -1;
                    });

                return {
                    module: sModule,
                    milestones: aOwn.map(function (oMilestone) {
                        return { ID: oMilestone.ID, milestoneType: oMilestone.milestoneType, status: oMilestone.status };
                    }),
                    msTotal: aCounted.length,
                    msDone: aCounted.filter(function (oMilestone) {
                        return oMilestone.status === "Completed";
                    }).length,
                    team: (aTeam || []).filter(function (oMember) {
                        return (oMember.modules || []).some(function (oOwn) {
                            return oOwn.module === sModule;
                        });
                    }).map(function (oMember) {
                        return { name: oMember.person ? oMember.person.name : "", role: oMember.role };
                    })
                };
            });
        },

        /**
         * How many of the rows (audits, attachments) are a module's.
         * @param {string} sModule the module
         * @param {{module: string}[]} aRows rows with the module of their milestone
         * @returns {number} the count
         */
        count: function (sModule, aRows) {
            return (aRows || []).filter(function (oRow) {
                return oRow.module === sModule;
            }).length;
        }
    };
});
