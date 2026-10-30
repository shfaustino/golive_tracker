sap.ui.define([], function () {
    "use strict";

    /**
     * The modules and milestone types: lists Administrators manage
     * (/admin/Modules, /admin/MilestoneTypes), read by everyone from
     * /project/Modules and /project/MilestoneTypes when the app starts
     * (Component#loadLists) and again after an Administrator changes them.
     * Held here, once for the whole app, so the formatters that turn a code
     * into its name (formatter.moduleName, formatter.milestoneTypeText) and
     * the choices that offer the active ones read the same lists.
     */
    var mModules = {},
        mTypes = {},
        aModules = [],
        aTypes = [];

    /**
     * @param {object[]} aRows rows with code and active
     * @returns {object[]} the active ones
     */
    function active(aRows) {
        return aRows.filter(function (oRow) {
            return oRow.active !== false;
        });
    }

    return {

        /**
         * The lists as read from the API.
         * @param {{code: string, name: string, active: boolean}[]} aNewModules the modules
         * @param {{code: string, name: string, requiresAudit: boolean, sortOrder: number, active: boolean}[]} aNewTypes the milestone types
         */
        set: function (aNewModules, aNewTypes) {
            aModules = (aNewModules || []).slice().sort(function (a, b) {
                return a.code.localeCompare(b.code);
            });
            aTypes = (aNewTypes || []).slice().sort(function (a, b) {
                return (a.sortOrder || 0) - (b.sortOrder || 0) || a.code.localeCompare(b.code);
            });
            mModules = {};
            mTypes = {};
            aModules.forEach(function (oModule) {
                mModules[oModule.code] = oModule;
            });
            aTypes.forEach(function (oType) {
                mTypes[oType.code] = oType;
            });
        },

        /**
         * @param {string} sCode a module's code
         * @returns {string} its name; empty for one not in the list
         */
        moduleName: function (sCode) {
            return mModules[sCode] ? mModules[sCode].name : "";
        },

        /**
         * @param {string} sCode a milestone type's code
         * @returns {string} its name; empty for one not in the list (or before the lists are read)
         */
        typeName: function (sCode) {
            return mTypes[sCode] ? mTypes[sCode].name : "";
        },

        /**
         * @param {string} sCode a milestone type's code
         * @returns {boolean} whether its milestones require an audit (BR-10)
         */
        requiresAudit: function (sCode) {
            return !!(mTypes[sCode] && mTypes[sCode].requiresAudit);
        },

        /**
         * The active modules, to choose from (by code).
         * @returns {{code: string, name: string}[]} them
         */
        activeModules: function () {
            return active(aModules);
        },

        /**
         * The active milestone types, to choose from (in timeline order).
         * @returns {{code: string, name: string}[]} them
         */
        activeTypes: function () {
            return active(aTypes);
        },

        /**
         * Every module, inactive ones too: what the API takes.
         * @returns {string[]} their codes
         */
        moduleCodes: function () {
            return aModules.map(function (oModule) {
                return oModule.code;
            });
        }
    };
});
