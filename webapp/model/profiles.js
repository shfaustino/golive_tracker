sap.ui.define([], function () {
    "use strict";

    /**
     * The three profiles the API knows (People.profile). The API enforces
     * every rule itself (docs/backend-api-guide.md, "Quem é o utilizador e o
     * que pode fazer"); these flags only decide what the UI offers.
     */
    var ADMINISTRATOR = "Administrator",
        ARCHITECT = "Architect",
        USER = "User";

    return {

        ADMINISTRATOR: ADMINISTRATOR,
        ARCHITECT: ARCHITECT,
        USER: USER,

        /**
         * What a profile may do, as flags for the "user" model.
         * @param {string|null} sProfile Administrator, Architect, User, or null while unknown
         * @returns {{isAdmin: boolean, seesAllProjects: boolean, canCreateProject: boolean}} the flags
         */
        permissions: function (sProfile) {
            return {
                isAdmin: sProfile === ADMINISTRATOR,
                seesAllProjects: sProfile === ADMINISTRATOR || sProfile === ARCHITECT,
                // Anyone signed in may create a project: the creator joins its
                // team as PM (or PMO when another PM is named).
                canCreateProject: sProfile === ADMINISTRATOR || sProfile === ARCHITECT || sProfile === USER
            };
        }
    };
});
