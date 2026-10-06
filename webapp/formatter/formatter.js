sap.ui.define([
    "sap/ui/core/library",
    "../model/memberRules"
], function (coreLibrary, memberRules) {
    "use strict";

    var ValueState = coreLibrary.ValueState;

    /**
     * How each project status looks in a list (docs/mockups/03-projetos.png):
     * the i18n key of its label and the colour of its chip.
     */
    var PROJECT_STATUS = {
        NotStarted: { text: "statusNotStarted", state: ValueState.Information },
        InProgress: { text: "statusInProgress", state: ValueState.Success },
        OnHold: { text: "statusOnHold", state: ValueState.Warning },
        Replanning: { text: "statusReplanning", state: ValueState.Warning },
        Closing: { text: "statusClosing", state: ValueState.Information },
        Closed: { text: "statusClosed", state: ValueState.Success },
        Cancelled: { text: "statusCancelled", state: ValueState.Error }
    };

    /**
     * How each milestone status looks (docs/mockups/04-projeto-marcos.png).
     */
    var MILESTONE_STATUS = {
        Planned: { text: "msStatusPlanned", state: ValueState.None },
        InProgress: { text: "msStatusInProgress", state: ValueState.Information },
        Completed: { text: "msStatusCompleted", state: ValueState.Success },
        Postponed: { text: "msStatusPostponed", state: ValueState.Warning },
        NotApplicable: { text: "msStatusNotApplicable", state: ValueState.None },
        Cancelled: { text: "msStatusCancelled", state: ValueState.Error }
    };

    /**
     * The i18n key of each milestone type's label. The API's values carry
     * spaces and dashes ("Go-live", "Report delivery"), so they cannot be
     * i18n keys themselves.
     */
    var MILESTONE_TYPE = {
        "KO": "msTypeKO",
        "PTO": "msTypePTO",
        "GOP": "msTypeGOP",
        "Training": "msTypeTraining",
        "Testing": "msTypeTesting",
        "Go-live": "msTypeGoLive",
        "Report delivery": "msTypeReportDelivery",
        "Closure": "msTypeClosure"
    };

    /**
     * The i18n key of each member role's label. The API's values carry
     * spaces ("Functional lead"), so they cannot be i18n keys themselves.
     */
    var ROLE = {
        "PM": "rolePM",
        "Functional lead": "roleFunctionalLead",
        "Technical lead": "roleTechnicalLead",
        "Testing owner": "roleTestingOwner",
        "Requirements owner": "roleRequirementsOwner",
        "Architect": "roleArchitect",
        "PMO": "rolePMO"
    };

    return {

        /**
         * The label of a project status, in the app's language. Formatters run
         * with the controller as "this", which is where the bundle comes from.
         * @param {string} sStatus the API's value, e.g. "InProgress"
         * @returns {string} the label, or the raw value when unknown
         */
        projectStatusText: function (sStatus) {
            var oEntry = PROJECT_STATUS[sStatus];

            return oEntry ? this.getResourceBundle().getText(oEntry.text) : (sStatus || "");
        },

        /**
         * The chip colour of a project status.
         * @param {string} sStatus the API's value
         * @returns {sap.ui.core.ValueState} the state
         */
        projectStatusState: function (sStatus) {
            return PROJECT_STATUS[sStatus] ? PROJECT_STATUS[sStatus].state : ValueState.None;
        },

        /**
         * The label of a milestone status.
         * @param {string} sStatus the API's value, e.g. "Completed"
         * @returns {string} the label, or the raw value when unknown
         */
        milestoneStatusText: function (sStatus) {
            var oEntry = MILESTONE_STATUS[sStatus];

            return oEntry ? this.getResourceBundle().getText(oEntry.text) : (sStatus || "");
        },

        /**
         * The chip text of a milestone: "Em atraso" when the API says it is
         * overdue (isOverdue, BR-07), its status otherwise.
         * @param {string} sStatus the API's value
         * @param {boolean} [bOverdue] the milestone's isOverdue
         * @returns {string} the label
         */
        milestoneStatusLabel: function (sStatus, bOverdue) {
            if (bOverdue) {
                return this.getResourceBundle().getText("msOverdue");
            }
            return MILESTONE_STATUS[sStatus] ? this.getResourceBundle().getText(MILESTONE_STATUS[sStatus].text) : (sStatus || "");
        },

        /**
         * The chip colour of a milestone status; an overdue milestone is red
         * whatever its status (isOverdue, BR-07).
         * @param {string} sStatus the API's value
         * @param {boolean} [bOverdue] the milestone's isOverdue
         * @returns {sap.ui.core.ValueState} the state
         */
        milestoneStatusState: function (sStatus, bOverdue) {
            if (bOverdue) {
                return ValueState.Error;
            }
            return MILESTONE_STATUS[sStatus] ? MILESTONE_STATUS[sStatus].state : ValueState.None;
        },

        /**
         * The label of a milestone type ("KO" -> "Kick-off").
         * @param {string} sType the API's milestoneType
         * @returns {string} the label, or the raw value when unknown
         */
        milestoneTypeText: function (sType) {
            return MILESTONE_TYPE[sType] ? this.getResourceBundle().getText(MILESTONE_TYPE[sType]) : (sType || "");
        },

        /**
         * An Edm.Date as the app shows dates, or a dash for none ("—" in the
         * mockup's empty "Data real").
         * @param {string} sDate YYYY-MM-DD, as the API sends it
         * @returns {string} DD/MM/YYYY, or "—"
         */
        dateOrDash: function (sDate) {
            var aParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sDate || "");

            return aParts ? aParts[3] + "/" + aParts[2] + "/" + aParts[1] : "—";
        },

        /**
         * The day of an ISO 8601 timestamp, as the app shows dates, in the
         * browser's time zone ("Última atualização").
         * @param {string} sTimestamp e.g. 2026-10-02T09:15:00Z
         * @returns {string} DD/MM/YYYY, or "—"
         */
        timestampDate: function (sTimestamp) {
            var oDate = sTimestamp ? new Date(sTimestamp) : null;

            if (!oDate || isNaN(oDate.getTime())) {
                return "—";
            }
            return String(oDate.getDate()).padStart(2, "0") + "/" + String(oDate.getMonth() + 1).padStart(2, "0") +
                "/" + oDate.getFullYear();
        },

        /**
         * A share as the legend shows it, with a decimal comma ("31,8%").
         * @param {number} fPct the percentage
         * @returns {string} the text
         */
        percent: function (fPct) {
            return typeof fPct === "number" ? String(fPct).replace(".", ",") + "%" : "";
        },

        /**
         * The label of a member role ("Functional lead" -> "Líder funcional").
         * @param {string} sRole the API's role
         * @returns {string} the label, or the raw value when unknown
         */
        roleText: function (sRole) {
            return ROLE[sRole] ? this.getResourceBundle().getText(ROLE[sRole]) : (sRole || "");
        },

        /**
         * "Ativo" or "Inativo", from the membership's end date.
         * @param {string|null} sEndDate the member's endDate
         * @returns {string} the label
         */
        memberStateText: function (sEndDate) {
            return this.getResourceBundle().getText(memberRules.isActive(sEndDate) ? "teamActive" : "teamInactive");
        },

        /**
         * The chip colour of a membership: green while it runs, red once ended.
         * @param {string|null} sEndDate the member's endDate
         * @returns {sap.ui.core.ValueState} the state
         */
        memberState: function (sEndDate) {
            return memberRules.isActive(sEndDate) ? ValueState.Success : ValueState.Error;
        },

        /**
         * Initials for an avatar: the first letter of the first and the last
         * name ("Marlon Teixeira" -> "MT").
         * @param {string} sName full name
         * @returns {string} one or two capital letters, or "" for no name
         */
        initials: function (sName) {
            var aParts = (sName || "").trim().split(/\s+/).filter(Boolean);

            if (!aParts.length) {
                return "";
            }
            return (aParts[0][0] + (aParts.length > 1 ? aParts[aParts.length - 1][0] : "")).toUpperCase();
        },

        /**
         * The profile's label under the person's name in the header.
         * @param {string} sProfile Administrator, Architect or User
         * @returns {string} the label
         */
        profileText: function (sProfile) {
            return sProfile ? this.getResourceBundle().getText("profile" + sProfile) : "";
        }
    };
});
