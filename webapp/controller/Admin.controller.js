sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "./adminActions",
    "../model/paging",
    "../formatter/formatter"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast, adminActions, paging, formatter) {
    "use strict";

    /** Rows per page, as in the mockup ("A mostrar 1-10 de 24 pessoas"). */
    var PAGE_SIZE = 10;

    /** The tab each route opens on. */
    var TAB_BY_ROUTE = { people: "pessoas", clients: "clientes", admin: "pessoas" };

    return BaseController.extend("com.amt.golivetracker.controller.Admin", Object.assign({}, adminActions, {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({
                busy: false, tab: "pessoas", title: "", subtitle: "", newText: "",
                rows: [], page: 1, pageCount: 0, pages: [], rangeText: "", search: "", profile: "", state: ""
            }), "dir");
            this.setModel(new JSONModel({ busy: false, kind: "person", values: {}, errors: {} }), "record");
            ["people", "clients", "admin"].forEach(function (sRoute) {
                this.getRouter().getRoute(sRoute).attachPatternMatched(this._onRouteMatched, this);
            }, this);
        },

        /**
         * A tab was picked: its own route, so the side navigation and the URL follow.
         * @param {sap.ui.base.Event} oEvent select of the IconTabBar
         * @public
         */
        onTabSelect: function (oEvent) {
            this.getRouter().navTo(oEvent.getParameter("key") === "clientes" ? "clients" : "people");
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
         * Called by adminActions after every change: the page is read again.
         * @param {string} sToastKey i18n key of the toast
         * @private
         */
        _onRecordsChanged: function (sToastKey) {
            MessageToast.show(this.getResourceBundle().getText(sToastKey));
            this._load(this.getModel("dir").getProperty("/page"));
        },

        /**
         * Pessoas, Clientes or Administração: the tab, its texts, and page 1.
         * @param {sap.ui.base.Event} oEvent patternMatched
         * @private
         */
        _onRouteMatched: function (oEvent) {
            var oDir = this.getModel("dir"),
                oBundle = this.getResourceBundle(),
                sTab = TAB_BY_ROUTE[oEvent.getParameter("name")],
                bPeople = sTab === "pessoas";

            if (oDir.getProperty("/tab") !== sTab) {
                oDir.setProperty("/search", "");
                this.byId("dirSearch").setValue("");
            }
            oDir.setProperty("/tab", sTab);
            oDir.setProperty("/title", oBundle.getText(bPeople ? "navPeople" : "navClients"));
            oDir.setProperty("/subtitle", oBundle.getText(bPeople ? "admPeopleSubtitle" : "admClientsSubtitle"));
            oDir.setProperty("/newText", oBundle.getText(bPeople ? "admNewPerson" : "admNewClient"));
            // me() decides between /admin (everything) and /project (active, read only)
            this.getOwnerComponent().pSignedInUser.then(this._load.bind(this, 1));
        },

        /**
         * One page of people or clients. An Administrator reads /admin, with
         * the inactive ones and every field; anyone else reads /project.
         * @param {number} iPage 1-based
         * @private
         */
        _load: function (iPage) {
            var oDir = this.getModel("dir"),
                oBundle = this.getResourceBundle(),
                bAdmin = !!this.getOwnerComponent().getModel("user").getProperty("/isAdmin"),
                bPeople = oDir.getProperty("/tab") === "pessoas",
                aFilters = [],
                oBinding,
                iRequest = (this._iRequest || 0) + 1;

            if (bPeople && oDir.getProperty("/profile")) {
                aFilters.push(new Filter("profile", FilterOperator.EQ, oDir.getProperty("/profile")));
            }
            if (bAdmin && oDir.getProperty("/state")) {
                aFilters.push(new Filter("active", FilterOperator.EQ, oDir.getProperty("/state") === "active"));
            }
            oBinding = this.getOwnerComponent().getModel(bAdmin ? "admin" : undefined).bindList(
                bPeople ? "/People" : "/Clients", undefined, [], aFilters, {
                    $count: true,
                    $orderby: "name",
                    $select: this._select(bPeople, bAdmin),
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
                oDir.setProperty("/rows", aContexts.map(function (oContext) {
                    return oContext.getObject();
                }));
                oDir.setProperty("/page", oPage.page);
                oDir.setProperty("/pageCount", oPage.pageCount);
                oDir.setProperty("/pages", oPage.pages);
                oDir.setProperty("/rangeText", oPage.total
                    ? oBundle.getText(bPeople ? "admRangePeople" : "admRangeClients", [oPage.from, oPage.to, oPage.total])
                    : "");
            }.bind(this)).catch(function () {
                oDir.setProperty("/rows", []);
            }).finally(function () {
                if (iRequest === this._iRequest) {
                    oDir.setProperty("/busy", false);
                }
                oBinding.destroy();
            }.bind(this));
        },

        /**
         * The fields each service has: /project lists only active records,
         * without status, and its clients have no NIF.
         * @param {boolean} bPeople people or clients
         * @param {boolean} bAdmin /admin or /project
         * @returns {string} the $select
         * @private
         */
        _select: function (bPeople, bAdmin) {
            if (bPeople) {
                return bAdmin ? "ID,name,email,profile,active" : "ID,name,email,profile";
            }
            return bAdmin ? "ID,name,taxId,erpCode,active" : "ID,name,erpCode";
        }
    }));
});
