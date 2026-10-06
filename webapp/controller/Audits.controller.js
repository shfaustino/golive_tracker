sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "./auditDialogs",
    "../model/auditRows",
    "../model/paging",
    "../formatter/formatter"
], function (BaseController, JSONModel, Filter, FilterOperator, auditDialogs, auditRows, paging, formatter) {
    "use strict";

    /** Rows per page, as in the mockup ("A mostrar 1-12 de 42 resultados"). */
    var PAGE_SIZE = 12;

    return BaseController.extend("com.amt.golivetracker.controller.Audits", Object.assign({}, auditDialogs, {

        formatter: formatter,

        onInit: function () {
            this._initAuditModels();
            this._sAuditRowModel = "audits";
            this._bAuditOpenProject = true;
            this.setModel(new JSONModel({
                busy: false, rows: [], page: 1, pageCount: 0, pages: [], rangeText: "",
                sort: { path: "date", desc: true }, search: ""
            }), "audits");
            this.getRouter().getRoute("audits").attachPatternMatched(this._onRouteMatched, this);
        },

        onNewAudit: function () {
            this.openNewAudit();
        },

        onSearch: function (oEvent) {
            var sTerm = this.getSearchTermFromEvent(oEvent);

            this.applySearchFromEvent(oEvent, function () {
                this.getModel("audits").setProperty("/search", sTerm);
                this._load(1);
            }.bind(this));
        },

        onFilterChange: function () {
            this._load(1);
        },

        onSort: function (oEvent) {
            var oModel = this.getModel("audits"),
                sPath = oEvent.getSource().data("sortPath"),
                oSort = oModel.getProperty("/sort");

            oModel.setProperty("/sort", { path: sPath, desc: oSort.path === sPath ? !oSort.desc : false });
            this._load(1);
        },

        onPagePress: function (oEvent) {
            this._load(oEvent.getSource().getBindingContext("audits").getProperty("n"));
        },

        onPagePrevious: function () {
            this._load(this.getModel("audits").getProperty("/page") - 1);
        },

        onPageNext: function () {
            this._load(this.getModel("audits").getProperty("/page") + 1);
        },

        onOpenProject: function (oEvent) {
            this.getRouter().navTo("projectDetail", {
                projectId: oEvent.getSource().getBindingContext("audits").getProperty("project_ID"),
                tab: "auditorias"
            });
        },

        /**
         * Called by auditDialogs after every change: the page is read again.
         * @private
         */
        _onAuditsChanged: function () {
            this._load(this.getModel("audits").getProperty("/page"));
        },

        /** @private */
        _onRouteMatched: function () {
            this._load(this.getModel("audits").getProperty("/page"));
            this._loadAuditChoices();
        },

        /**
         * One page of audits, with $count for the pager.
         * @param {number} iPage 1-based
         * @private
         */
        _load: function (iPage) {
            var oModel = this.getModel("audits"),
                oSort = oModel.getProperty("/sort"),
                oBundle = this.getResourceBundle(),
                aFilters = [],
                sProject = this.byId("auditProjectFilter").getSelectedKey(),
                sResult = this.byId("auditResultFilter").getSelectedKey(),
                oBinding,
                iRequest = (this._iRequest || 0) + 1;

            if (sProject) {
                aFilters.push(new Filter("milestone/project_ID", FilterOperator.EQ, sProject));
            }
            if (sResult) {
                // "Por iniciar" (NotStarted) is an audit with no result yet (model/auditRules.js)
                aFilters.push(new Filter("result", FilterOperator.EQ, sResult === "NotStarted" ? null : sResult));
            }
            oBinding = this.getOwnerComponent().getModel().bindList("/Audits", undefined, [], aFilters,
                Object.assign({ $count: true }, auditRows.QUERY, {
                    $orderby: oSort.path + (oSort.desc ? " desc" : ""),
                    $search: oModel.getProperty("/search") || undefined
                }));

            this._iRequest = iRequest;
            oModel.setProperty("/busy", true);
            oBinding.requestContexts((iPage - 1) * PAGE_SIZE, PAGE_SIZE).then(function (aContexts) {
                var oPage;

                if (iRequest !== this._iRequest) {
                    return;
                }
                oPage = paging.describe(iPage, PAGE_SIZE, oBinding.getCount() || 0);
                oModel.setProperty("/rows", aContexts.map(function (oContext) {
                    return auditRows.flatten(oContext.getObject());
                }));
                oModel.setProperty("/page", oPage.page);
                oModel.setProperty("/pageCount", oPage.pageCount);
                oModel.setProperty("/pages", oPage.pages);
                oModel.setProperty("/rangeText", oPage.total ? oBundle.getText("auditRange", [oPage.from, oPage.to, oPage.total]) : "");
            }.bind(this)).catch(function () {
                oModel.setProperty("/rows", []);
            }).finally(function () {
                if (iRequest === this._iRequest) {
                    oModel.setProperty("/busy", false);
                }
                oBinding.destroy();
            }.bind(this));
        }
    }));
});
