sap.ui.define([
    "./projectAudits",
    "./projectAttachments"
], function (projectAudits, projectAttachments) {
    "use strict";

    /**
     * A project's Auditorias and Anexos tabs together, mixed into
     * ProjectDetail.controller.js as one: both list records that hang under
     * the project and share their dialogs with a page of their own.
     */
    return Object.assign({}, projectAudits, projectAttachments, {

        /** @private */
        _initProjectRecordTabs: function () {
            this._initProjectAudits();
            this._initProjectAttachments();
        },

        /**
         * Both tabs' lists for the project now on show.
         * @private
         */
        _loadProjectRecordTabs: function () {
            this.getModel("projAudits").setProperty("/rows", []);
            this.getModel("atts").setProperty("/rows", []);
            this._loadProjectAudits();
            this._loadProjectAttachments();
        }
    });
});
