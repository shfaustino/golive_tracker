sap.ui.define([
    "sap/ui/core/library"
], function (coreLibrary) {
    "use strict";

    var ValueState = coreLibrary.ValueState;

    /**
     * How each project status looks in a list (docs/mockups/03-projetos.png):
     * the i18n key of its label and the colour of its chip.
     */
    var PROJECT_STATUS = {
        NotStarted: { text: "statusNotStarted", state: ValueState.None },
        InProgress: { text: "statusInProgress", state: ValueState.Success },
        OnHold: { text: "statusOnHold", state: ValueState.Warning },
        Replanning: { text: "statusReplanning", state: ValueState.Information },
        Closing: { text: "statusClosing", state: ValueState.Information },
        Closed: { text: "statusClosed", state: ValueState.Success },
        Cancelled: { text: "statusCancelled", state: ValueState.Error }
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
