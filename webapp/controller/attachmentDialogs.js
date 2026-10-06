sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/ActionSheet",
    "sap/m/Button",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/library",
    "../model/attachmentRules",
    "../formatter/formatter"
], function (JSONModel, ActionSheet, Button, MessageBox, MessageToast, mobileLibrary, attachmentRules, formatter) {
    "use strict";

    /** The batch group attachment changes are sent in. */
    var ATTACH_GROUP = "attachEdit";

    /**
     * Novo anexo and a row's actions (Abrir, Abrir projeto, Eliminar), shared
     * by the Anexos page and a project's Anexos tab (US-29, BR-11). An
     * attachment is a link (http or https) on exactly one owner: the
     * project, one of its milestones, or one of a milestone's items; it is
     * created and deleted under that owner's path, and cannot move.
     *
     * Mixed into the host controller, which calls _initAttachmentModels() in
     * onInit, names in _sAttachmentRowModel the JSON model its rows live in
     * (rows from attachmentRules.flatten), and implements
     * _onAttachmentsChanged().
     */
    return {

        /** @private */
        _initAttachmentModels: function () {
            this.setModel(new JSONModel({
                busy: false, values: {}, errors: {}, projects: [], milestones: [], items: [],
                types: attachmentRules.DOCUMENT_TYPES.map(function (sType) {
                    return { key: sType, text: formatter.documentTypeText.call(this, sType) };
                }, this)
            }), "attach");
        },

        /**
         * Novo anexo, optionally for one project (a project's tab passes it).
         * @param {string} [sProjectId] the project
         * @public
         */
        openNewAttachment: function (sProjectId) {
            var oAttach = this.getModel("attach");

            oAttach.setData(Object.assign({}, oAttach.getData(), {
                busy: false,
                projectFixed: !!sProjectId,
                errors: {},
                milestones: [],
                items: [],
                values: {
                    project_ID: sProjectId || null, owner: "project", milestone_ID: null, milestoneItem_ID: null,
                    documentType: "", name: "", url: ""
                }
            }));
            if (!oAttach.getProperty("/projects").length) {
                this._readAttachRows("/Projects", { $select: "ID,code,name", $orderby: "code" }).then(function (aRows) {
                    oAttach.setProperty("/projects", aRows);
                });
            }
            this._loadAttachMilestones();
            this._getAttachmentDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        onAttachmentProjectChange: function () {
            var oAttach = this.getModel("attach");

            oAttach.setProperty("/values/milestone_ID", null);
            oAttach.setProperty("/values/milestoneItem_ID", null);
            this._loadAttachMilestones();
        },

        onAttachmentMilestoneChange: function () {
            this.getModel("attach").setProperty("/values/milestoneItem_ID", null);
            this._loadAttachItems();
        },

        onSaveAttachment: function () {
            var oAttach = this.getModel("attach"),
                oValues = oAttach.getProperty("/values"),
                oBundle = this.getResourceBundle(),
                oKeys = attachmentRules.validate(oValues),
                oErrors = {},
                oModel = this.getOwnerComponent().getModel(),
                oBinding,
                oContext;

            Object.keys(oKeys).forEach(function (sField) {
                oErrors[sField] = oBundle.getText(oKeys[sField]);
            });
            oAttach.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }
            oAttach.setProperty("/busy", true);
            oBinding = oModel.bindList(attachmentRules.collectionPath(oValues), undefined, [], [], { $$updateGroupId: ATTACH_GROUP });
            oContext = oBinding.create(attachmentRules.body(oValues));
            oContext.created().catch(function () {
                // taken back by resetChanges below on a refusal
            });
            oModel.submitBatch(ATTACH_GROUP).then(function () {
                oAttach.setProperty("/busy", false);
                if (oModel.hasPendingChanges(ATTACH_GROUP)) {
                    oModel.resetChanges(ATTACH_GROUP);
                } else {
                    MessageToast.show(oBundle.getText("attAdded"));
                    this.onCancelAttachment();
                    this._onAttachmentsChanged();
                }
                oBinding.destroy();
            }.bind(this));
        },

        onCancelAttachment: function () {
            this._getAttachmentDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * Opens a row's link in a new tab.
         * @param {sap.ui.base.Event} oEvent press of the row's name
         * @public
         */
        onOpenAttachment: function (oEvent) {
            mobileLibrary.URLHelper.redirect(oEvent.getSource().getBindingContext(this._sAttachmentRowModel).getProperty("url"), true);
        },

        /**
         * A row's "…": Abrir, Abrir projeto, Eliminar.
         * @param {sap.ui.base.Event} oEvent press of the row's button
         * @public
         */
        onAttachmentActions: function (oEvent) {
            var oButton = oEvent.getSource(),
                oRow = oButton.getBindingContext(this._sAttachmentRowModel).getObject(),
                oBundle = this.getResourceBundle(),
                aButtons = [new Button({
                    text: oBundle.getText("attOpen"), icon: "sap-icon://inspect",
                    press: function () {
                        mobileLibrary.URLHelper.redirect(oRow.url, true);
                    }
                })];

            if (this._bAttachmentOpenProject) {
                aButtons.push(new Button({
                    text: oBundle.getText("openProject"), icon: "sap-icon://folder-blank",
                    press: function () {
                        this.getRouter().navTo("projectDetail", { projectId: oRow.projectID, tab: "anexos" });
                    }.bind(this)
                }));
            }
            aButtons.push(new Button({
                text: oBundle.getText("auditDelete"), icon: "sap-icon://delete", type: "Reject", press: this._deleteAttachment.bind(this, oRow)
            }));
            if (this._oAttachMenu) {
                this._oAttachMenu.destroy();
            }
            this._oAttachMenu = new ActionSheet({ placement: "Bottom", buttons: aButtons });
            this.getView().addDependent(this._oAttachMenu);
            this._oAttachMenu.openBy(oButton);
        },

        /**
         * Asks first, then DELETE under the attachment's owner.
         * @param {object} oRow the row
         * @private
         */
        _deleteAttachment: function (oRow) {
            var oBundle = this.getResourceBundle();

            MessageBox.confirm(oBundle.getText("attDeleteConfirm", [oRow.name]), {
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    // under its owner: the only path the API takes for an attachment
                    this.writeUnderParent("DELETE", attachmentRules.entityPath(oRow)).then(function (bDone) {
                        if (bDone) {
                            MessageToast.show(oBundle.getText("attDeleted"));
                            this._onAttachmentsChanged();
                        }
                    }.bind(this));
                }.bind(this)
            });
        },

        /**
         * The chosen project's milestones, to attach to one of them.
         * @private
         */
        _loadAttachMilestones: function () {
            var oAttach = this.getModel("attach"),
                sProjectId = oAttach.getProperty("/values/project_ID");

            oAttach.setProperty("/milestones", []);
            oAttach.setProperty("/items", []);
            if (!sProjectId) {
                return;
            }
            this._readAttachRows("/Projects(" + sProjectId + ")/milestones", {
                $select: "ID,milestoneType,forecastEnd", $orderby: "sortOrder"
            }).then(function (aRows) {
                oAttach.setProperty("/milestones", aRows.map(function (oMilestone) {
                    return {
                        ID: oMilestone.ID,
                        label: formatter.milestoneTypeText.call(this, oMilestone.milestoneType) + " · " +
                            formatter.dateOrDash(oMilestone.forecastEnd)
                    };
                }, this));
            }.bind(this));
        },

        /**
         * The chosen milestone's items, to attach to one of them.
         * @private
         */
        _loadAttachItems: function () {
            var oAttach = this.getModel("attach"),
                oValues = oAttach.getProperty("/values");

            oAttach.setProperty("/items", []);
            if (!oValues.project_ID || !oValues.milestone_ID) {
                return;
            }
            this._readAttachRows("/Projects(" + oValues.project_ID + ")/milestones(" + oValues.milestone_ID + ")/items", {
                $select: "ID,name,type", $orderby: "date"
            }).then(function (aRows) {
                oAttach.setProperty("/items", aRows);
            });
        },

        /**
         * @param {string} sPath a collection
         * @param {object} mParameters query options
         * @returns {Promise<object[]>} the rows, none when the read fails
         * @private
         */
        _readAttachRows: function (sPath, mParameters) {
            var oBinding = this.getOwnerComponent().getModel().bindList(sPath, undefined, [], [], mParameters);

            return oBinding.requestContexts(0, 1000).then(function (aContexts) {
                return aContexts.map(function (oContext) {
                    return oContext.getObject();
                });
            }).catch(function () {
                return [];
            }).finally(function () {
                oBinding.destroy();
            });
        },

        /**
         * @returns {Promise<sap.m.Dialog>} the attachment dialog, loaded once
         * @private
         */
        _getAttachmentDialog: function () {
            if (!this._pAttachmentDialog) {
                this._pAttachmentDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.AttachmentDialog" });
            }
            return this._pAttachmentDialog;
        }
    };
});
