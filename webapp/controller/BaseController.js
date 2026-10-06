sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "../service/childWrites"
], function (Controller, UIComponent, History, childWrites) {
    "use strict";

    /**
     * How long a pause in typing counts as "done typing", so a search box
     * does not send one request per keystroke.
     */
    var SEARCH_DEBOUNCE_MS = 300;

    return Controller.extend("com.amt.golivetracker.controller.BaseController", {

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        onExit: function () {
            Object.keys(this._mSearchTimers || {}).forEach(function (sKey) {
                clearTimeout(this._mSearchTimers[sKey]);
            }, this);
        },

        /**
         * Back to where the user came from, or to the given route when the
         * app was opened straight on this page.
         * @public
         * @param {string} [sFallbackRoute] route when there is no history, "dashboard" by default
         */
        navBack: function (sFallbackRoute) {
            if (History.getInstance().getPreviousHash() !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo(sFallbackRoute || "dashboard", {}, undefined, true);
            }
        },

        /**
         * A PATCH or a DELETE of something under a project, sent to the path
         * under its parent (/Projects(<id>)/milestones(<id>)), which is the
         * only one the API takes for it; service/childWrites.js says why the
         * OData model cannot send it there. A refusal shows the API's message.
         * @public
         * @param {string} sMethod PATCH or DELETE
         * @param {string} sPath path in the /project service, starting with /
         * @param {object} [oBody] the fields to change
         * @returns {Promise<boolean>} whether the API took it
         */
        writeUnderParent: function (sMethod, sPath, oBody) {
            return childWrites.write(this.getOwnerComponent().getModel(), sMethod, sPath, oBody);
        },

        /**
         * The text typed into a SearchField, whether the event was a search or
         * a liveChange.
         * @public
         * @param {sap.ui.base.Event} oEvent event of the SearchField
         * @returns {string} the term, trimmed
         */
        getSearchTermFromEvent: function (oEvent) {
            return (oEvent.getParameter("query") || oEvent.getParameter("newValue") || "").trim();
        },

        /**
         * Runs a search now (Enter, the magnifier, the clear button) or once
         * the typing pauses (liveChange). One timer per search box.
         * @public
         * @param {sap.ui.base.Event} oEvent event of the SearchField
         * @param {function} fnApply what to run
         */
        applySearchFromEvent: function (oEvent, fnApply) {
            var sBoxId = oEvent.getSource().getId();

            this._mSearchTimers = this._mSearchTimers || {};
            clearTimeout(this._mSearchTimers[sBoxId]);
            if (oEvent.getId() === "liveChange") {
                // A debounce: the delay is the point.
                // eslint-disable-next-line @sap-ux/fiori-tools/sap-timeout-usage
                this._mSearchTimers[sBoxId] = setTimeout(fnApply, SEARCH_DEBOUNCE_MS);
            } else {
                fnApply();
            }
        }
    });
});
