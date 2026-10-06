sap.ui.define([], function () {
    "use strict";

    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        // a Portuguese NIF: nine digits
        TAX_ID = /^\d{9}$/;

    /**
     * Only the fields that changed, for a PATCH.
     * @param {object} oBefore the record as read
     * @param {object} oAfter the dialog's values
     * @param {string[]} aFields the fields the dialog edits
     * @returns {object} the changed fields
     */
    function changes(oBefore, oAfter, aFields) {
        var oChanges = {};

        aFields.forEach(function (sField) {
            var vBefore = oBefore[sField] === undefined ? null : oBefore[sField],
                vAfter = oAfter[sField] === undefined || oAfter[sField] === "" ? null : oAfter[sField];

            if (vBefore !== vAfter) {
                oChanges[sField] = vAfter;
            }
        });
        return oChanges;
    }

    return {

        PROFILES: ["Administrator", "Architect", "User"],

        PERSON_FIELDS: ["name", "email", "profile", "active"],

        CLIENT_FIELDS: ["name", "taxId", "erpCode", "active"],

        changes: changes,

        /**
         * Checks a person (AdminService People) before it is sent. The API
         * stores the email in lower case and refuses a repeated one (409).
         * @param {{name: string, email: string, profile: string}} oValues the form
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validatePerson: function (oValues) {
            var oErrors = {};

            if (!(oValues.name || "").trim()) {
                oErrors.name = "pfErrorRequired";
            }
            if (!(oValues.email || "").trim()) {
                oErrors.email = "pfErrorRequired";
            } else if (!EMAIL.test(oValues.email.trim())) {
                oErrors.email = "admErrorEmail";
            }
            if (!oValues.profile) {
                oErrors.profile = "pfErrorRequired";
            }
            return oErrors;
        },

        /**
         * Checks a client before it is sent. Name and NIF are unique (409
         * from the API); a NIF, when given, has nine digits.
         * @param {{name: string, taxId: string}} oValues the form
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validateClient: function (oValues) {
            var oErrors = {};

            if (!(oValues.name || "").trim()) {
                oErrors.name = "pfErrorRequired";
            }
            if ((oValues.taxId || "").trim() && !TAX_ID.test(oValues.taxId.trim())) {
                oErrors.taxId = "admErrorTaxId";
            }
            return oErrors;
        },

        /**
         * A person as the API takes it: trimmed, the email in lower case.
         * @param {object} oValues the form
         * @returns {object} the body
         */
        personBody: function (oValues) {
            return {
                name: oValues.name.trim(),
                email: oValues.email.trim().toLowerCase(),
                profile: oValues.profile,
                active: oValues.active !== false
            };
        },

        /**
         * A client as the API takes it: trimmed, empty optional fields as null.
         * @param {object} oValues the form
         * @returns {object} the body
         */
        clientBody: function (oValues) {
            return {
                name: oValues.name.trim(),
                taxId: (oValues.taxId || "").trim() || null,
                erpCode: (oValues.erpCode || "").trim() || null,
                active: oValues.active !== false
            };
        }
    };
});
