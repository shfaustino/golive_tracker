sap.ui.define([
    "./auditRules"
], function (auditRules) {
    "use strict";

    return {

        /**
         * What a list of audits reads: the audit, its milestone and that
         * milestone's project, the auditor's name and the follow-ups' status.
         */
        QUERY: {
            $select: "ID,milestone_ID,code,date,auditor_ID,result,notes",
            $expand: "milestone($select=ID,milestoneType,module,project_ID;$expand=project($select=ID,code,name))," +
                "auditor($select=name),followUps($select=ID,status)"
        },

        /**
         * One audit as a table row: the nested parts flattened, and the
         * follow-ups counted.
         * @param {object} oAudit an audit read with QUERY
         * @returns {object} the row
         */
        flatten: function (oAudit) {
            var oMilestone = oAudit.milestone || {},
                oProject = oMilestone.project || {},
                oFollowUps = auditRules.followUps(oAudit.followUps);

            return {
                ID: oAudit.ID,
                milestone_ID: oAudit.milestone_ID,
                code: oAudit.code,
                date: oAudit.date,
                auditor_ID: oAudit.auditor_ID,
                auditorName: oAudit.auditor ? oAudit.auditor.name : "",
                result: oAudit.result,
                notes: oAudit.notes,
                milestoneType: oMilestone.milestoneType,
                module: oMilestone.module || null,
                project_ID: oMilestone.project_ID || oProject.ID,
                projectCode: oProject.code,
                projectName: oProject.name,
                fuTotal: oFollowUps.total,
                fuOpen: oFollowUps.open
            };
        }
    };
});
