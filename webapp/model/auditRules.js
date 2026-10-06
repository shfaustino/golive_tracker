sap.ui.define([], function () {
    "use strict";

    var OPEN = ["ToDo", "InProgress"];

    /** "Por iniciar": an audit with no result yet, which the API keeps as null. */
    var NOT_STARTED = "NotStarted";

    /**
     * The API's result for the form's: "Por iniciar" is none.
     * @param {string} sResult the form's result
     * @returns {string|null} the API's
     */
    function toApi(sResult) {
        return sResult && sResult !== NOT_STARTED ? sResult : null;
    }

    return {

        NOT_STARTED: NOT_STARTED,

        RESULTS: [NOT_STARTED, "Approved", "ApprovedWithReservations", "Rejected"],

        toApi: toApi,

        /**
         * The form's result for the API's: none is "Por iniciar".
         * @param {string|null} sResult the API's result
         * @returns {string} the form's
         */
        fromApi: function (sResult) {
            return sResult || NOT_STARTED;
        },

        /**
         * Checks an audit before it is sent. The code may stay empty: the API
         * then suggests one (<project number>_<milestone>_<ddmmyyyy>).
         * @param {{milestone_ID: string, date: string, auditor_ID: string, result: string}} oValues the form
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validate: function (oValues) {
            var oErrors = {};

            ["milestone_ID", "date", "auditor_ID", "result"].forEach(function (sField) {
                if (!oValues[sField]) {
                    oErrors[sField] = "pfErrorRequired";
                }
            });
            return oErrors;
        },

        /**
         * Checks a follow-up (ProjectService.addFollowUp) before it is sent.
         * @param {{name: string, owner_ID: string, date: string}} oValues the form
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validateFollowUp: function (oValues) {
            var oErrors = {};

            if (!(oValues.name || "").trim()) {
                oErrors.name = "pfErrorRequired";
            }
            if (!oValues.owner_ID) {
                oErrors.owner_ID = "pfErrorRequired";
            }
            if (!oValues.date) {
                oErrors.date = "pfErrorRequired";
            }
            return oErrors;
        },

        /**
         * How an audit's follow-ups stand: all of them, and those still open
         * (to do or in progress). Closing a project needs none open (BR-09).
         * @param {{status: string}[]} aFollowUps the audit's followUps
         * @returns {{total: number, open: number}} the counts
         */
        followUps: function (aFollowUps) {
            var aAll = aFollowUps || [];

            return {
                total: aAll.length,
                open: aAll.filter(function (oItem) {
                    return OPEN.indexOf(oItem.status) !== -1;
                }).length
            };
        },

        /**
         * The patch an edit sends: only what changed.
         * @param {object} oBefore the audit as read
         * @param {object} oAfter the dialog's values
         * @returns {object} the changed fields
         */
        changes: function (oBefore, oAfter) {
            var oChanges = {};

            ["code", "date", "auditor_ID", "result", "notes"].forEach(function (sField) {
                var vBefore = sField === "result" ? toApi(oBefore[sField]) : oBefore[sField] || null,
                    vAfter = sField === "result" ? toApi(oAfter[sField]) : oAfter[sField] || null;

                if (vBefore !== vAfter) {
                    oChanges[sField] = vAfter;
                }
            });
            return oChanges;
        }
    };
});
