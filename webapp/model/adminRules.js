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

        // the code is the key: it is set when the record is created, and never changes
        MODULE_FIELDS: ["name", "active"],

        TYPE_FIELDS: ["name", "requiresAudit", "sortOrder", "active"],

        /**
         * Checks a module before it is sent: a code (the key, up to 20
         * characters, unique: 409 from the API) and a name.
         * @param {{code: string, name: string}} oValues the form
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validateModule: function (oValues) {
            var oErrors = {},
                sCode = (oValues.code || "").trim();

            if (!sCode) {
                oErrors.code = "pfErrorRequired";
            } else if (sCode.length > 20) {
                oErrors.code = "admErrorCodeLength";
            }
            if (!(oValues.name || "").trim()) {
                oErrors.name = "pfErrorRequired";
            }
            return oErrors;
        },

        /**
         * Checks a milestone type: as a module, and an order that is a whole
         * number, when given.
         * @param {{code: string, name: string, sortOrder: (string|number)}} oValues the form
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validateType: function (oValues) {
            var oErrors = this.validateModule(oValues),
                sOrder = String(oValues.sortOrder === null || oValues.sortOrder === undefined ? "" : oValues.sortOrder).trim();

            if (sOrder && !/^\d+$/.test(sOrder)) {
                oErrors.sortOrder = "admErrorOrder";
            }
            return oErrors;
        },

        /**
         * A module as the API takes it.
         * @param {object} oValues the form
         * @returns {object} the body
         */
        moduleBody: function (oValues) {
            return { code: oValues.code.trim(), name: oValues.name.trim(), active: oValues.active !== false };
        },

        /**
         * A milestone type as the API takes it; with no order, it goes at the end (100).
         * @param {object} oValues the form
         * @returns {object} the body
         */
        typeBody: function (oValues) {
            var sOrder = String(oValues.sortOrder === null || oValues.sortOrder === undefined ? "" : oValues.sortOrder).trim();

            return {
                code: oValues.code.trim(),
                name: oValues.name.trim(),
                requiresAudit: !!oValues.requiresAudit,
                sortOrder: sOrder ? parseInt(sOrder, 10) : 100,
                active: oValues.active !== false
            };
        },

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
