sap.ui.define([], function () {
    "use strict";

    /**
     * The member roles the API knows (docs/backend-api-guide.md, "Listas de
     * valores"). PM is handed over, not added: there is always exactly one
     * active PM (BR-03), changed through handOverPM.
     */
    var ROLES = ["PM", "Functional lead", "Technical lead", "Testing owner", "Requirements owner", "Architect", "PMO"];

    /**
     * Today as YYYY-MM-DD, in the browser's time zone.
     * @param {Date} [oNow] now, for tests
     * @returns {string} the date
     */
    function today(oNow) {
        var oDate = oNow || new Date();

        return oDate.getFullYear() + "-" + String(oDate.getMonth() + 1).padStart(2, "0") + "-" +
            String(oDate.getDate()).padStart(2, "0");
    }

    return {

        ROLES: ROLES,

        today: today,

        /**
         * Whether a membership is running: no end date ("endDate vazio =
         * ativo"), or one that has not passed yet.
         * @param {string|null} sEndDate the member's endDate, YYYY-MM-DD
         * @param {Date} [oNow] now, for tests
         * @returns {boolean} active
         */
        isActive: function (sEndDate, oNow) {
            return !sEndDate || sEndDate >= today(oNow);
        },

        /**
         * The roles a member can be given in the add or edit dialog: every
         * role but PM, which only handOverPM sets. A member who already is
         * the PM keeps PM on the list, so the dialog can show it.
         * @param {string} [sCurrentRole] the role being edited
         * @returns {string[]} the roles
         */
        assignableRoles: function (sCurrentRole) {
            return ROLES.filter(function (sRole) {
                return sRole !== "PM" || sCurrentRole === "PM";
            });
        },

        /**
         * Checks a membership before it is sent, so the user sees the problem
         * next to the field rather than as a refusal from the API.
         * @param {{mode: string, person_ID: string, role: string, startDate: string, endDate: string}} oValues
         *   the dialog's values; mode is "add", "edit" or "handover"
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validate: function (oValues) {
            var oErrors = {};

            if (oValues.mode !== "edit" && !oValues.person_ID) {
                oErrors.person_ID = "memberErrorPerson";
            }
            if (oValues.mode !== "handover" && !oValues.role) {
                oErrors.role = "memberErrorRole";
            }
            if (!oValues.startDate) {
                oErrors.startDate = "memberErrorStart";
            }
            if (oValues.mode !== "handover" && oValues.startDate && oValues.endDate && oValues.endDate < oValues.startDate) {
                oErrors.endDate = "memberErrorEndBeforeStart";
            }
            return oErrors;
        }
    };
});
