sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "../model/paging",
    "../formatter/formatter"
], function (BaseController, JSONModel, Filter, FilterOperator, Sorter, paging, formatter) {
    "use strict";

    /** Rows per page, as in the mockup ("A mostrar 1-10 de 24 projetos"). */
    var PAGE_SIZE = 10;

    return BaseController.extend("com.amt.golivetracker.controller.Projects", {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({
                busy: false,
                rows: [],
                page: 1,
                pageCount: 0,
                pages: [],
                rangeText: "",
                sort: { path: "code", desc: false },
                search: ""
            }), "list");
            this.setModel(new JSONModel({ clients: [], people: [] }), "options");
            this.getRouter().getRoute("projects").attachPatternMatched(this._onRouteMatched, this);
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
                this.getModel("list").setProperty("/search", sTerm);
                this._load(1);
            }.bind(this));
        },

        /**
         * One of the status, client or PM filters changed: back to page 1.
         * @public
         */
        onFilterChange: function () {
            this._load(1);
        },

        /**
         * A column header was clicked: sort by it, or turn the order round
         * when it already sorts.
         * @param {sap.ui.base.Event} oEvent press of the header button
         * @public
         */
        onSort: function (oEvent) {
            var oListModel = this.getModel("list"),
                sPath = oEvent.getSource().data("sortPath"),
                oSort = oListModel.getProperty("/sort");

            oListModel.setProperty("/sort", {
                path: sPath,
                desc: oSort.path === sPath ? !oSort.desc : false
            });
            this._load(1);
        },

        onPagePress: function (oEvent) {
            this._load(oEvent.getSource().getBindingContext("list").getProperty("n"));
        },

        onPagePrevious: function () {
            this._load(this.getModel("list").getProperty("/page") - 1);
        },

        onPageNext: function () {
            this._load(this.getModel("list").getProperty("/page") + 1);
        },

        onNewProject: function () {
            this.getRouter().navTo("projectCreate");
        },

        /**
         * Opens the project the row (its code, or its "…") belongs to.
         * @param {sap.ui.base.Event} oEvent press of the row, the link or the button
         * @public
         */
        onProjectPress: function (oEvent) {
            this.getRouter().navTo("projectDetail", {
                projectId: oEvent.getSource().getBindingContext("list").getProperty("ID")
            });
        },

        /**
         * Every visit reads the current page again. Arriving from the top
         * bar's search carries its term in app>/globalSearch: it fills this
         * page's own box and is used once.
         * @private
         */
        _onRouteMatched: function () {
            var oAppModel = this.getOwnerComponent().getModel("app"),
                sTerm = oAppModel.getProperty("/globalSearch");

            if (typeof sTerm === "string") {
                oAppModel.setProperty("/globalSearch", undefined);
                this.byId("projectSearch").setValue(sTerm);
                this.getModel("list").setProperty("/search", sTerm);
                this._load(1);
            } else {
                this._load(this.getModel("list").getProperty("/page"));
            }
            if (!this._bOptionsLoaded) {
                this._bOptionsLoaded = true;
                this._loadOptions();
            }
        },

        /**
         * Reads one page of projects, with the total ($count) for the pager.
         * A throwaway list binding, not one bound to the table: the table
         * shows the page held in the "list" model, so the page can be any
         * page and not only the next one.
         * @param {number} iPage 1-based page
         * @private
         */
        _load: function (iPage) {
            var oListModel = this.getModel("list"),
                oSort = oListModel.getProperty("/sort"),
                oBundle = this.getResourceBundle(),
                oBinding = this.getOwnerComponent().getModel().bindList("/Projects", undefined,
                    [new Sorter(oSort.path, oSort.desc)], this._filters(), {
                        $count: true,
                        $select: "ID,code,name,status,needsReview,reviewReason,lastUpdateAt",
                        $expand: "client($select=name),pm($select=ID;$expand=person($select=name))",
                        $search: oListModel.getProperty("/search") || undefined
                    }),
                iRequest = (this._iRequest || 0) + 1;

            this._iRequest = iRequest;
            oListModel.setProperty("/busy", true);
            oBinding.requestContexts((iPage - 1) * PAGE_SIZE, PAGE_SIZE).then(function (aContexts) {
                var oPage;

                // A slower answer to an older request must not overwrite a newer one.
                if (iRequest !== this._iRequest) {
                    return;
                }
                oPage = paging.describe(iPage, PAGE_SIZE, oBinding.getCount() || 0);
                oListModel.setProperty("/rows", aContexts.map(function (oContext) {
                    return oContext.getObject();
                }));
                oListModel.setProperty("/page", oPage.page);
                oListModel.setProperty("/pageCount", oPage.pageCount);
                oListModel.setProperty("/pages", oPage.pages);
                oListModel.setProperty("/rangeText", oPage.total
                    ? oBundle.getText("projectsRange", [oPage.from, oPage.to, oPage.total])
                    : "");
            }.bind(this)).catch(function () {
                oListModel.setProperty("/rows", []);
            }).finally(function () {
                if (iRequest === this._iRequest) {
                    oListModel.setProperty("/busy", false);
                }
                oBinding.destroy();
            }.bind(this));
        },

        /**
         * Status, client and PM, all at once. pm is the project's active PM,
         * so "PM = x" filters on pm/person_ID.
         * @returns {sap.ui.model.Filter[]} the filters
         * @private
         */
        _filters: function () {
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
            return aFilters;
        },

        /**
         * The client and PM choices, read once: GET /project/Clients and
         * /project/People list only active ones. An empty filter is "Todos".
         * @private
         */
        _loadOptions: function () {
            var oModel = this.getOwnerComponent().getModel(),
                oOptions = this.getModel("options");

            ["clients", "people"].forEach(function (sKey) {
                var oBinding = oModel.bindList(sKey === "clients" ? "/Clients" : "/People", undefined,
                    [new Sorter("name")], [], { $select: "ID,name" });

                oBinding.requestContexts(0, 1000).then(function (aContexts) {
                    oOptions.setProperty("/" + sKey, aContexts.map(function (oContext) {
                        return { key: oContext.getProperty("ID"), text: oContext.getProperty("name") };
                    }));
                }).catch(function () {
                    // the filter stays empty, i.e. "Todos"; the ErrorHandler has said why
                }).finally(function () {
                    oBinding.destroy();
                });
            });
        }
    });
});
