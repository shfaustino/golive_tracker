sap.ui.define([
    "./BaseController",
    "sap/m/library",
    "../formatter/formatter"
], function (BaseController, mobileLibrary, formatter) {
    "use strict";

    /**
     * Which side navigation entry each route lights up. Pages under an area
     * (a project's detail, the new project form) keep their area selected.
     */
    var AREA_BY_ROUTE = {
        dashboard: "dashboard",
        projects: "projects",
        projectCreate: "projects",
        projectDetail: "projects",
        myWork: "myWork",
        audits: "audits",
        attachments: "attachments",
        people: "people",
        clients: "clients",
        admin: "admin"
    };

    return BaseController.extend("com.amt.golivetracker.controller.App", {

        formatter: formatter,

        onInit: function () {
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
            this.getRouter().attachRouteMatched(this._onRouteMatched, this);
        },

        /**
         * Navigates to the route the pressed entry names.
         * @param {sap.ui.base.Event} oEvent itemSelect of the SideNavigation
         * @public
         */
        onNavItemSelect: function (oEvent) {
            var sRoute = oEvent.getParameter("item").getKey();

            if (sRoute) {
                this.getRouter().navTo(sRoute);
            }
        },

        /**
         * Collapses or expands the side navigation.
         * @public
         */
        onSideToggle: function () {
            var oAppModel = this.getOwnerComponent().getModel("app");

            oAppModel.setProperty("/sideExpanded", !oAppModel.getProperty("/sideExpanded"));
        },

        /**
         * The top bar's search: for now it searches projects, on the Projetos
         * page.
         * @param {sap.ui.base.Event} oEvent search of the SearchField
         * @public
         */
        onGlobalSearch: function (oEvent) {
            var sTerm = this.getSearchTermFromEvent(oEvent);

            this.getOwnerComponent().getModel("app").setProperty("/globalSearch", sTerm);
            this.getRouter().navTo("projects");
        },

        /**
         * Ends the SAP session through the approuter's logout endpoint
         * (deploy/approuter/xs-app.json).
         * @public
         */
        onLogout: function () {
            mobileLibrary.URLHelper.redirect("/do/logout", false);
        },

        /**
         * Keeps app>/route in step with the router, so the side navigation
         * highlights the area you are in, however you got there.
         * @param {sap.ui.base.Event} oEvent routeMatched event
         * @private
         */
        _onRouteMatched: function (oEvent) {
            var sArea = AREA_BY_ROUTE[oEvent.getParameter("name")];

            if (sArea) {
                this.getOwnerComponent().getModel("app").setProperty("/route", sArea);
            }
        }
    });
});
