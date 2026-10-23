sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "./adminActions",
    "../model/paging",
    "../model/adminTabs",
    "../formatter/formatter"
], function (BaseController, JSONModel, Filter, FilterOperator, adminActions, paging, adminTabs, formatter) {
    "use strict";

    /** Rows per page, as in the mockup ("A mostrar 1-10 de 24 pessoas"). */
    var PAGE_SIZE = 10;

    return BaseController.extend("com.amt.golivetracker.controller.Admin", Object.assign({}, adminActions, {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({
                busy: false, tab: "pessoas", title: "", subtitle: "", newText: "",
                rows: [], page: 1, pageCount: 0, pages: [], rangeText: "", search: "", profile: "", state: "", selectedCount: 0
            }), "dir");
            this.setModel(new JSONModel({ busy: false, kind: "person", values: {}, errors: {} }), "record");
            Object.keys(adminTabs.TABS).map(function (sTab) {
                return adminTabs.TABS[sTab].route;
            }).concat(["admin"]).forEach(function (sRoute) {
                this.getRouter().getRoute(sRoute).attachPatternMatched(this._onRouteMatched, this);
            }, this);
        },

        /**
         * A tab was picked: its own route, so the side navigation and the URL follow.
         * @param {sap.ui.base.Event} oEvent select of the IconTabBar
         * @public
         */
        onTabSelect: function (oEvent) {
            this.getRouter().navTo(adminTabs.of(oEvent.getParameter("key")).route);
        },

        onTabPeople: function () {
            this.getRouter().navTo("admin");
        },

        onSearch: function (oEvent) {
            var sTerm = this.getSearchTermFromEvent(oEvent);

            this.applySearchFromEvent(oEvent, function () {
                this.getModel("dir").setProperty("/search", sTerm);
                this._load(1);
            }.bind(this));
        },

        onFilterChange: function () {
            this._load(1);
        },

        onPagePress: function (oEvent) {
            this._load(oEvent.getSource().getBindingContext("dir").getProperty("n"));
        },

        onPagePrevious: function () {
            this._load(this.getModel("dir").getProperty("/page") - 1);
        },

        onPageNext: function () {
            this._load(this.getModel("dir").getProperty("/page") + 1);
        },

        /**
         * @returns {object} the configuration of the tab on show (model/adminTabs.js)
         * @private
         */
        _tab: function () {
            return adminTabs.of(this.getModel("dir").getProperty("/tab"));
        },

        /**
         * A tab of Administração (Pessoas, Clientes, Módulos, Tipos de marco):
         * the tab, its texts, and page 1.
         * @param {sap.ui.base.Event} oEvent patternMatched
         * @private
         */
        _onRouteMatched: function (oEvent) {
            var oDir = this.getModel("dir"),
                oBundle = this.getResourceBundle(),
                sTab = adminTabs.tabOfRoute(oEvent.getParameter("name")),
                oTexts = adminTabs.of(sTab).texts;

            if (oDir.getProperty("/tab") !== sTab) {
                oDir.setProperty("/search", "");
                this.byId("dirSearch").setValue("");
            }
            oDir.setProperty("/tab", sTab);
            oDir.setProperty("/title", oBundle.getText(oTexts.title));
            oDir.setProperty("/subtitle", oBundle.getText(oTexts.subtitle));
            oDir.setProperty("/newText", oBundle.getText(oTexts.newText));
            // me() decides between /admin (everything) and /project (active, read only)
            this.getOwnerComponent().pSignedInUser.then(this._load.bind(this, 1));
        },

        /**
         * One page of the tab's records. An Administrator reads /admin, with
         * the inactive ones and every field; anyone else reads /project
         * (Pessoas and Clientes only).
         * @param {number} iPage 1-based
         * @private
         */
        _load: function (iPage) {
            var oDir = this.getModel("dir"),
                oBundle = this.getResourceBundle(),
                bAdmin = !!this.getOwnerComponent().getModel("user").getProperty("/isAdmin"),
                oTab = this._tab(),
                aFilters = [],
                oBinding,
                iRequest = (this._iRequest || 0) + 1;

            if (oTab.kind === "person" && oDir.getProperty("/profile")) {
                aFilters.push(new Filter("profile", FilterOperator.EQ, oDir.getProperty("/profile")));
            }
            if (bAdmin && oDir.getProperty("/state")) {
                aFilters.push(new Filter("active", FilterOperator.EQ, oDir.getProperty("/state") === "active"));
            }
            oBinding = this.getOwnerComponent().getModel(bAdmin ? "admin" : undefined).bindList(
                "/" + oTab.set, undefined, [], aFilters, {
                    $count: true,
                    $orderby: oTab.orderBy,
                    $select: bAdmin ? oTab.select : oTab.projectSelect,
                    $search: oDir.getProperty("/search") || undefined
                });

            this._iRequest = iRequest;
            oDir.setProperty("/busy", true);
            oBinding.requestContexts((iPage - 1) * PAGE_SIZE, PAGE_SIZE).then(function (aContexts) {
                var oPage;

                if (iRequest !== this._iRequest) {
                    return;
                }
                oPage = paging.describe(iPage, PAGE_SIZE, oBinding.getCount() || 0);
                // a selection is of the rows on show: a new page, or tab, starts with none
                Object.keys(adminTabs.TABS).forEach(function (sTab) {
                    this.byId(adminTabs.TABS[sTab].table).removeSelections(true);
                }, this);
                oDir.setProperty("/selectedCount", 0);
                oDir.setProperty("/rows", aContexts.map(function (oContext) {
                    return oContext.getObject();
                }));
                oDir.setProperty("/page", oPage.page);
                oDir.setProperty("/pageCount", oPage.pageCount);
                oDir.setProperty("/pages", oPage.pages);
                oDir.setProperty("/rangeText", oPage.total ? oBundle.getText(oTab.texts.range, [oPage.from, oPage.to, oPage.total]) : "");
            }.bind(this)).catch(function () {
                oDir.setProperty("/rows", []);
            }).finally(function () {
                if (iRequest === this._iRequest) {
                    oDir.setProperty("/busy", false);
                }
                oBinding.destroy();
            }.bind(this));
        }
    }));
});
