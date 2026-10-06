sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "./attachmentDialogs",
    "../model/attachmentRules"
], function (JSONModel, Filter, FilterOperator, attachmentDialogs, attachmentRules) {
    "use strict";

    /**
     * A project's Anexos tab: the project's attachments, wherever they hang
     * (on it, a milestone or an item), and the Anexos page's dialogs
     * (./attachmentDialogs, brought in with this). Mixed into
     * ProjectDetail.controller.js through ./projectRecordTabs.
     */
    return Object.assign({}, attachmentDialogs, {

        /** @private */
        _initProjectAttachments: function () {
            this._initAttachmentModels();
            this._sAttachmentRowModel = "atts";
            this._bAttachmentOpenProject = false;
            this.setModel(new JSONModel({
                busy: false, rows: [], showProject: false, noDataText: this.getResourceBundle().getText("attProjectNoData")
            }), "atts");
        },

        onNewProjectAttachment: function () {
            this.openNewAttachment(this._sProjectId);
        },

        /** Called by attachmentDialogs after every change. @private */
        _onAttachmentsChanged: function () {
            this._loadProjectAttachments();
        },

        /**
         * GET /project/AllAttachments for this project, newest first.
         * @private
         */
        _loadProjectAttachments: function () {
            var oModel = this.getModel("atts"),
                sProjectId = this._sProjectId,
                oBinding = this.getOwnerComponent().getModel().bindList("/AllAttachments", undefined, [],
                    [new Filter("projectID", FilterOperator.EQ, sProjectId)],
                    Object.assign({ $orderby: "createdAt desc" }, attachmentRules.QUERY));

            oModel.setProperty("/busy", true);
            oBinding.requestContexts(0, 500).then(function (aContexts) {
                if (sProjectId === this._sProjectId) {
                    oModel.setProperty("/rows", aContexts.map(function (oContext) {
                        return attachmentRules.flatten(oContext.getObject());
                    }));
                }
            }.bind(this)).catch(function () {
                oModel.setProperty("/rows", []);
            }).finally(function () {
                oModel.setProperty("/busy", false);
                oBinding.destroy();
            });
        }
    });
});
