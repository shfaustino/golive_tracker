sap.ui.define([], function () {
    "use strict";

    /**
     * The project types and the milestones the API generates for each
     * (docs/backend-api-guide.md, "Criar e editar"); audit: the milestone
     * needs an audit (★ in the guide, BR-10).
     */
    var TEMPLATES = {
        "Implementation": [["KO"], ["PTO"], ["GOP", true], ["Training"], ["Testing", true], ["Go-live", true], ["Closure"]],
        "Rollout": [["KO"], ["GOP"], ["Testing", true], ["Go-live", true], ["Closure"]],
        "Integration": [["KO"], ["PTO"], ["Testing"], ["Go-live"], ["Closure"]],
        "Enhancements/CR": [["KO"], ["Testing"], ["Go-live"], ["Closure"]],
        "Assessment": [["KO"], ["Report delivery"], ["Closure"]],
        "Change management": [["KO"], ["Training"], ["Closure"]],
        "Hours bank": [],
        "Ticket > 40h": [],
        "T&M/Outsourcing": []
    };

    var MODULES = ["EC", "ECP", "TT", "P&G", "REC", "ONB", "LMS", "Compensation", "Workzone", "FI", "SD", "EWM"];

    return {

        PROJECT_TYPES: Object.keys(TEMPLATES),

        MODULES: MODULES,

        /**
         * The milestones a project type brings.
         * @param {string} sType the projectType
         * @returns {{milestoneType: string, audit: boolean}[]} in order; none for unknown types
         */
        milestonesFor: function (sType) {
            return (TEMPLATES[sType] || []).map(function (aEntry) {
                return { milestoneType: aEntry[0], audit: aEntry[1] === true };
            });
        },

        /**
         * Checks the form before it is sent, so each problem shows next to
         * its field rather than as a refusal from the API.
         * @param {object} oValues the form: code, name, client_ID, projectType,
         *   startDate, endDate, value, currency_code, members[{person_ID, role, startDate}]
         * @returns {{fields: Object<string, string>, members: Object<number, string>}}
         *   per field, and per team row, the i18n key of what is wrong
         */
        validate: function (oValues) {
            var oFields = {},
                oMembers = {},
                aMembers = oValues.members || [],
                iPms = 0,
                mSeen = {};

            ["code", "name", "client_ID", "projectType", "startDate", "endDate", "currency_code"].forEach(function (sField) {
                if (!String(oValues[sField] || "").trim()) {
                    oFields[sField] = "pfErrorRequired";
                }
            });
            if (oValues.startDate && oValues.endDate && oValues.endDate < oValues.startDate) {
                oFields.endDate = "pfErrorEndBeforeStart";
            }
            if (oValues.value !== null && oValues.value !== undefined && oValues.value !== "" &&
                    (isNaN(Number(oValues.value)) || Number(oValues.value) < 0)) {
                oFields.value = "pfErrorValue";
            }

            aMembers.forEach(function (oMember, i) {
                var sKey = oMember.person_ID + "|" + oMember.role;

                if (!oMember.person_ID || !oMember.role) {
                    oMembers[i] = "pfErrorMember";
                } else if (mSeen[sKey]) {
                    oMembers[i] = "pfErrorDuplicate";
                } else if (oMember.role === "PM" && ++iPms > 1) {
                    // BR-03: one active PM
                    oMembers[i] = "pfErrorTwoPms";
                }
                mSeen[sKey] = true;
            });

            return { fields: oFields, members: oMembers };
        },

        /**
         * The POST /project/Projects body: a deep insert with the modules and
         * the team (the guide's example). Empty optional fields are left out;
         * a member's start defaults to the project's start.
         * @param {object} oValues the form, as validate takes it, plus externalCode and modules
         * @returns {object} the body
         */
        payload: function (oValues) {
            var oBody = {
                code: oValues.code.trim(),
                name: oValues.name.trim(),
                client_ID: oValues.client_ID,
                projectType: oValues.projectType,
                startDate: oValues.startDate,
                endDate: oValues.endDate,
                currency_code: oValues.currency_code,
                modules: (oValues.modules || []).map(function (sModule) {
                    return { module: sModule };
                }),
                members: (oValues.members || []).map(function (oMember) {
                    return { person_ID: oMember.person_ID, role: oMember.role, startDate: oMember.startDate || oValues.startDate };
                })
            };

            if ((oValues.externalCode || "").trim()) {
                oBody.externalCode = oValues.externalCode.trim();
            }
            if ((oValues.description || "").trim()) {
                oBody.description = oValues.description.trim();
            }
            if (oValues.value !== null && oValues.value !== undefined && oValues.value !== "") {
                oBody.value = Number(oValues.value);
            }
            return oBody;
        }
    };
});
