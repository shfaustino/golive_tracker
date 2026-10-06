sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "./attachmentDialogs",
    "../model/attachmentRules",
    "../model/paging",
    "../formatter/formatter"
], function (BaseController, JSONModel, Filter, FilterOperator, attachmentDialogs, attachmentRules, paging, formatter) {
    "use strict";

    var PAGE_SIZE = 12;

    return BaseController.extend("com.amt.golivetracker.controller.Attachments", Object.assign({}, attachmentDialogs, {

        formatter: formatter,

        onInit: function () {
            var oBundle = this.getResourceBundle();

            this._initAttachmentModels();
            this._sAttachmentRowModel = "atts";
            this._bAttachmentOpenProject = true;
            this.setModel(new JSONModel({
                busy: false, rows: [], page: 1, pageCount: 0, pages: [], rangeText: "", search: "",
                showProject: true, noDataText: oBundle.getText("attNoData"),
                typeFilter: [{ key: "", text: oBundle.getText("filterAll") }].concat(attachmentRules.DOCUMENT_TYPES.map(function (sType) {
                    return { key: sType, text: formatter.documentTypeText.call(this, sType) };
                }, this))
            }), "atts");
            this.getRouter().getRoute("attachments").attachPatternMatched(this._onRouteMatched, this);
        },

        onNewAttachment: function () {
            this.openNewAttachment();
        },

        onSearch: function (oEvent) {
            var sTerm = this.getSearchTermFromEvent(oEvent);

            this.applySearchFromEvent(oEvent, function () {
                this.getModel("atts").setProperty("/search", sTerm);
                this._load(1);
            }.bind(this));
        },

        onFilterChange: function () {
            this._load(1);
        },

        onPagePress: function (oEvent) {
            this._load(oEvent.getSource().getBindingContext("atts").getProperty("n"));
        },

        onPagePrevious: function () {
            this._load(this.getModel("atts").getProperty("/page") - 1);
        },

        onPageNext: function () {
            this._load(this.getModel("atts").getProperty("/page") + 1);
        },

        /**
         * Called by attachmentDialogs after every change.
         * @private
         */
        _onAttachmentsChanged: function () {
            this._load(this.getModel("atts").getProperty("/page"));
        },

        /** @private */
        _onRouteMatched: function () {
            var oAttach = this.getModel("attach");

            this._load(this.getModel("atts").getProperty("/page"));
            if (!oAttach.getProperty("/projects").length) {
                this._readAttachRows("/Projects", { $select: "ID,code,name", $orderby: "code" }).then(function (aRows) {
                    oAttach.setProperty("/projects", aRows);
                });
            }
        },

        /**
         * One page of attachments, newest first, with $count for the pager.
         * @param {number} iPage 1-based
         * @private
         */
        _load: function (iPage) {
            var oModel = this.getModel("atts"),
                oBundle = this.getResourceBundle(),
                aFilters = [],
                sProject = this.byId("attachmentProjectFilter").getSelectedKey(),
                sType = this.byId("attachmentTypeFilter").getSelectedKey(),
                oBinding,
                iRequest = (this._iRequest || 0) + 1;

            if (sProject) {
                aFilters.push(new Filter("projectID", FilterOperator.EQ, sProject));
            }
            if (sType) {
                aFilters.push(new Filter("documentType", FilterOperator.EQ, sType));
            }
            oBinding = this.getOwnerComponent().getModel().bindList("/AllAttachments", undefined, [], aFilters,
                Object.assign({ $count: true, $orderby: "createdAt desc" }, attachmentRules.QUERY, {
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
                    return attachmentRules.flatten(oContext.getObject());
                }));
                oModel.setProperty("/page", oPage.page);
                oModel.setProperty("/pageCount", oPage.pageCount);
                oModel.setProperty("/pages", oPage.pages);
                oModel.setProperty("/rangeText", oPage.total ? oBundle.getText("attRange", [oPage.from, oPage.to, oPage.total]) : "");
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
