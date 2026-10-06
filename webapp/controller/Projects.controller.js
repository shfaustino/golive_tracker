sap.ui.define([
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../formatter/formatter"
], function (BaseController, Filter, FilterOperator, formatter) {
    "use strict";

    return BaseController.extend("com.amt.golivetracker.controller.Projects", {

        formatter: formatter,

        onInit: function () {
            this.getRouter().getRoute("projects").attachPatternMatched(this._onRouteMatched, this);
            this.byId("projectsTable").attachUpdateFinished(this._onTableUpdated, this);
        },

        /**
         * Search typed here: free text over the projects' text fields, through
         * the API's $search (docs/backend-api-guide.md, "OData essencial").
         * @param {sap.ui.base.Event} oEvent search or liveChange of the SearchField
         * @public
         */
        onSearch: function (oEvent) {
            var sTerm = this.getSearchTermFromEvent(oEvent);

            this.applySearchFromEvent(oEvent, function () {
                this._applySearch(sTerm);
            }.bind(this));
        },

        /**
         * One of the status, client or PM filters changed.
         * @public
         */
        onFilterChange: function () {
            this._applyFilters();
        },

        onNewProject: function () {
            this.getRouter().navTo("projectCreate");
        },

        /**
         * Opens the project the row (or its code link) belongs to.
         * @param {sap.ui.base.Event} oEvent press of the row or of the link
         * @public
         */
        onProjectPress: function (oEvent) {
            this.getRouter().navTo("projectDetail", {
                projectId: oEvent.getSource().getBindingContext().getProperty("ID")
            });
        },

        /**
         * Arriving here from the top bar's search carries its term in
         * app>/globalSearch: it fills this page's own box and is used once.
         * @private
         */
        _onRouteMatched: function () {
            var oAppModel = this.getOwnerComponent().getModel("app"),
                sTerm = oAppModel.getProperty("/globalSearch");

            if (typeof sTerm === "string") {
                oAppModel.setProperty("/globalSearch", undefined);
                this.byId("projectSearch").setValue(sTerm);
                this._applySearch(sTerm);
            }
        },

        /**
         * @param {string} sTerm the text to search, "" for none
         * @private
         */
        _applySearch: function (sTerm) {
            this.byId("projectsTable").getBinding("items").changeParameters({
                $search: sTerm || undefined
            });
        },

        /**
         * Status, client and PM, all at once. pm is the project's active PM,
         * so "PM = x" filters on pm/person_ID.
         * @private
         */
        _applyFilters: function () {
            var aFilters = [],
                sStatus = this.byId("statusFilter").getSelectedKey(),
                sClient = this.byId("clientFilter").getSelectedKey(),
                sPm = this.byId("pmFilter").getSelectedKey();

            if (sStatus) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }
            if (sClient) {
                aFilters.push(new Filter("client_ID", FilterOperator.EQ, sClient));
            }
            if (sPm) {
                aFilters.push(new Filter("pm/person_ID", FilterOperator.EQ, sPm));
            }
            this.byId("projectsTable").getBinding("items").filter(aFilters);
        },

        /**
         * The table's title carries how many projects match ($count=true).
         * @private
         */
        _onTableUpdated: function () {
            var oBinding = this.byId("projectsTable").getBinding("items"),
                iCount = oBinding.getCount();

            this.byId("projectsCount").setText(this.getResourceBundle().getText(
                "projectsCount", [iCount === undefined ? oBinding.getLength() : iCount]));
        }
    });
});
