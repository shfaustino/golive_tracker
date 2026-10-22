sap.ui.define([], function () {
    "use strict";

    /** Milestone statuses that leave a milestone out of the progress. */
    var OUT = ["NotApplicable", "Cancelled"];

    /**
     * The module key, in the URL, of what belongs to no module: the
     * milestones of the whole project and the members who work on all of it.
     */
    var WHOLE_PROJECT = "Geral";

    /**
     * A module's milestones; for the whole project, those with no module.
     * @param {string} sModule a module, or WHOLE_PROJECT
     * @param {{module: string}[]} aMilestones the project's milestones
     * @returns {object[]} the module's, in the same order
     */
    function milestonesOf(sModule, aMilestones) {
        var sWanted = sModule === WHOLE_PROJECT ? null : sModule;

        return (aMilestones || []).filter(function (oMilestone) {
            return (oMilestone.module || null) === sWanted;
        });
    }

    /**
     * The members who work on a module; for the whole project, those with
     * no module (a member with none works on all of it).
     * @param {string} sModule a module, or WHOLE_PROJECT
     * @param {{modules: {module: string}[]}[]} aTeam the team
     * @returns {object[]} the module's members, in the same order
     */
    function membersOf(sModule, aTeam) {
        return (aTeam || []).filter(function (oMember) {
            var aOwn = oMember.modules || [];

            if (sModule === WHOLE_PROJECT) {
                return !aOwn.length;
            }
            return aOwn.some(function (oOwn) {
                return oOwn.module === sModule;
            });
        });
    }

    /**
     * Whether a row (an audit, an attachment) is a module's, through the
     * module of its milestone; for the whole project, a row with none.
     * @param {string} sModule a module, or WHOLE_PROJECT
     * @param {string} [sRowModule] the row's module
     * @returns {boolean} whether it is
     */
    function isOfModule(sModule, sRowModule) {
        return (sRowModule || null) === (sModule === WHOLE_PROJECT ? null : sModule);
    }

    return {

        WHOLE_PROJECT: WHOLE_PROJECT,

        milestonesOf: milestonesOf,

        membersOf: membersOf,

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
                    aOwn = milestonesOf(sModule, aMilestones),
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
                    team: membersOf(sModule, aTeam).map(function (oMember) {
                        return { name: oMember.person ? oMember.person.name : "", role: oMember.role };
                    })
                };
            });
        },

        /**
         * How many of the rows (audits, attachments) are a module's (isOfModule).
         * @param {string} sModule a module, or WHOLE_PROJECT
         * @param {{module: string}[]} aRows rows with the module of their milestone
         * @returns {number} the count
         */
        count: function (sModule, aRows) {
            return (aRows || []).filter(function (oRow) {
                return isOfModule(sModule, oRow.module);
            }).length;
        },

        isOfModule: isOfModule
    };
});
