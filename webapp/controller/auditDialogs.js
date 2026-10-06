sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/ActionSheet",
    "sap/m/Button",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../model/auditRules",
    "../model/memberRules",
    "../formatter/formatter"
], function (JSONModel, ActionSheet, Button, MessageBox, MessageToast, auditRules, memberRules, formatter) {
    "use strict";

    /** The batch group audit changes are sent in. */
    var AUDIT_GROUP = "auditEdit";

    /**
     * The audit dialogs (Nova auditoria, Editar, Adicionar follow-up,
     * Eliminar), shared by the Auditorias page and a project's Auditorias
     * tab. Mixed into their controllers, so `this` is the controller.
     *
     * The host calls _initAuditModels() in onInit, names in _sAuditRowModel
     * the JSON model its rows live in, and implements _onAuditsChanged(),
     * called after every change. A row is an audit flattened for display:
     * ID, milestone_ID, code, date, auditor_ID, result, notes, project_ID,
     * projectCode.
     */
    return {

        /** @private */
        _initAuditModels: function () {
            this.setModel(new JSONModel({ busy: false, values: {}, errors: {}, projects: [], milestones: [], people: [] }), "audit");
            this.setModel(new JSONModel({ busy: false, values: {}, errors: {}, people: [] }), "followUp");
        },

        /**
         * Nova auditoria, optionally for one project (a project's tab passes it).
         * @param {string} [sProjectId] the project the audit is for
         * @public
         */
        openNewAudit: function (sProjectId) {
            var oAudit = this.getModel("audit");

            this._oAuditRow = null;
            oAudit.setData(Object.assign({}, oAudit.getData(), {
                busy: false,
                mode: "create",
                title: this.getResourceBundle().getText("auditNew"),
                projectFixed: !!sProjectId,
                errors: {},
                milestones: [],
                values: {
                    project_ID: sProjectId || null, milestone_ID: null, code: "", date: memberRules.today(),
                    auditor_ID: this.getOwnerComponent().getModel("user").getProperty("/id"), result: "Approved", notes: ""
                }
            }));
            this._loadAuditChoices();
            if (sProjectId) {
                this._loadAuditMilestones(sProjectId);
            }
            this._getAuditDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * A row's "…": Editar, Adicionar follow-up, Abrir projeto, Eliminar.
         * @param {sap.ui.base.Event} oEvent press of the row's button
         * @public
         */
        onAuditActions: function (oEvent) {
            var oButton = oEvent.getSource(),
                oRow = oButton.getBindingContext(this._sAuditRowModel).getObject(),
                oBundle = this.getResourceBundle(),
                aButtons = [
                    new Button({ text: oBundle.getText("auditEdit"), icon: "sap-icon://edit", press: this._editAudit.bind(this, oRow) }),
                    new Button({ text: oBundle.getText("fuAdd"), icon: "sap-icon://add-activity", press: this._openFollowUp.bind(this, oRow) })
                ];

            if (this._bAuditOpenProject) {
                aButtons.push(new Button({
                    text: oBundle.getText("openProject"), icon: "sap-icon://folder-blank",
                    press: function () {
                        this.getRouter().navTo("projectDetail", { projectId: oRow.project_ID, tab: "auditorias" });
                    }.bind(this)
                }));
            }
            aButtons.push(new Button({
                text: oBundle.getText("auditDelete"), icon: "sap-icon://delete", type: "Reject", press: this._deleteAudit.bind(this, oRow)
            }));
            if (this._oAuditMenu) {
                this._oAuditMenu.destroy();
            }
            this._oAuditMenu = new ActionSheet({ placement: "Bottom", buttons: aButtons });
            this.getView().addDependent(this._oAuditMenu);
            this._oAuditMenu.openBy(oButton);
        },

        /**
         * A project was picked: offer its milestones that require an audit.
         * @public
         */
        onAuditProjectChange: function () {
            var oAudit = this.getModel("audit");

            oAudit.setProperty("/values/milestone_ID", null);
            this._loadAuditMilestones(oAudit.getProperty("/values/project_ID"));
        },

        onSaveAudit: function () {
            var oAudit = this.getModel("audit"),
                oValues = oAudit.getProperty("/values"),
                oBundle = this.getResourceBundle(),
                oKeys = auditRules.validate(oValues),
                oErrors = {};

            Object.keys(oKeys).forEach(function (sField) {
                oErrors[sField] = oBundle.getText(oKeys[sField]);
            });
            oAudit.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }
            oAudit.setProperty("/busy", true);
            (oAudit.getProperty("/mode") === "create" ? this._createAudit(oValues) : this._patchAudit(oValues))
                .then(function (bDone) {
                    oAudit.setProperty("/busy", false);
                    if (bDone) {
                        this.onCancelAudit();
                        this._onAuditsChanged();
                    }
                }.bind(this));
        },

        onCancelAudit: function () {
            this._getAuditDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        onSaveFollowUp: function () {
            var oFollowUp = this.getModel("followUp"),
                oValues = oFollowUp.getProperty("/values"),
                oBundle = this.getResourceBundle(),
                oKeys = auditRules.validateFollowUp(oValues),
                oErrors = {},
                oAction;

            Object.keys(oKeys).forEach(function (sField) {
                oErrors[sField] = oBundle.getText(oKeys[sField]);
            });
            oFollowUp.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }
            oFollowUp.setProperty("/busy", true);
            oAction = this.getOwnerComponent().getModel().bindContext(
                "/Audits(" + oFollowUp.getProperty("/auditId") + ")/ProjectService.addFollowUp(...)");
            oAction.setParameter("name", oValues.name.trim());
            oAction.setParameter("owner_ID", oValues.owner_ID);
            oAction.setParameter("date", oValues.date);
            if ((oValues.description || "").trim()) {
                oAction.setParameter("description", oValues.description.trim());
            }
            oAction.execute().then(function () {
                MessageToast.show(oBundle.getText("fuAdded"));
                this.onCancelFollowUp();
                this._onAuditsChanged();
            }.bind(this)).catch(function () {
                // the ErrorHandler shows the API's reason; the dialog stays
            }).finally(function () {
                oFollowUp.setProperty("/busy", false);
                oAction.destroy();
            });
        },

        onCancelFollowUp: function () {
            this._getFollowUpDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * @param {object} oRow the audit row
         * @private
         */
        _editAudit: function (oRow) {
            var oAudit = this.getModel("audit");

            this._oAuditRow = oRow;
            oAudit.setData(Object.assign({}, oAudit.getData(), {
                busy: false,
                mode: "edit",
                title: this.getResourceBundle().getText("auditEditTitle", [oRow.code]),
                projectFixed: true,
                errors: {},
                values: {
                    project_ID: oRow.project_ID, milestone_ID: oRow.milestone_ID, code: oRow.code, date: oRow.date,
                    auditor_ID: oRow.auditor_ID, result: oRow.result, notes: oRow.notes || ""
                }
            }));
            this._loadAuditChoices();
            this._loadAuditMilestones(oRow.project_ID);
            this._getAuditDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * POST /Audits. The code the API suggests is shown in the toast.
         * @param {object} oValues the dialog's values
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _createAudit: function (oValues) {
            var oModel = this.getOwnerComponent().getModel(),
                oBinding = oModel.bindList("/Audits", undefined, [], [], { $$updateGroupId: AUDIT_GROUP }),
                oBody = {
                    milestone_ID: oValues.milestone_ID, date: oValues.date, auditor_ID: oValues.auditor_ID,
                    result: oValues.result
                },
                oContext;

            if ((oValues.code || "").trim()) {
                oBody.code = oValues.code.trim();
            }
            if ((oValues.notes || "").trim()) {
                oBody.notes = oValues.notes.trim();
            }
            oContext = oBinding.create(oBody);
            oContext.created().catch(function () {
                // taken back by resetChanges below on a refusal
            });
            return oModel.submitBatch(AUDIT_GROUP).then(function () {
                if (oModel.hasPendingChanges(AUDIT_GROUP)) {
                    oModel.resetChanges(AUDIT_GROUP);
                    oBinding.destroy();
                    return false;
                }
                return oContext.created().then(function () {
                    MessageToast.show(this.getResourceBundle().getText("auditCreated", [oContext.getProperty("code")]));
                    oBinding.destroy();
                    return true;
                }.bind(this));
            }.bind(this));
        },

        /**
         * PATCH /Audits(<id>) with what changed.
         * @param {object} oValues the dialog's values
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _patchAudit: function (oValues) {
            var oModel = this.getOwnerComponent().getModel(),
                oChanges = auditRules.changes(this._oAuditRow, oValues),
                oBinding = oModel.bindContext("/Audits(" + this._oAuditRow.ID + ")", undefined, { $$updateGroupId: AUDIT_GROUP }),
                oContext = oBinding.getBoundContext();

            if (!Object.keys(oChanges).length) {
                oBinding.destroy();
                return Promise.resolve(true);
            }
            return oContext.requestObject().then(function () {
                Object.keys(oChanges).forEach(function (sField) {
                    oContext.setProperty(sField, oChanges[sField], AUDIT_GROUP).catch(function () {
                        // settled with the batch, below
                    });
                });
                return oModel.submitBatch(AUDIT_GROUP);
            }).then(function () {
                var bDone = !oModel.hasPendingChanges(AUDIT_GROUP);

                if (!bDone) {
                    oModel.resetChanges(AUDIT_GROUP);
                } else {
                    MessageToast.show(this.getResourceBundle().getText("auditSaved"));
                }
                oBinding.destroy();
                return bDone;
            }.bind(this));
        },

        /**
         * Asks first, then DELETE /Audits(<id>).
         * @param {object} oRow the audit row
         * @private
         */
        _deleteAudit: function (oRow) {
            var oBundle = this.getResourceBundle(),
                oModel = this.getOwnerComponent().getModel();

            MessageBox.confirm(oBundle.getText("auditDeleteConfirm", [oRow.code]), {
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    var oBinding, oContext;

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    oBinding = oModel.bindContext("/Audits(" + oRow.ID + ")", undefined, { $$updateGroupId: AUDIT_GROUP });
                    oContext = oBinding.getBoundContext();
                    oContext.requestObject().then(function () {
                        oContext.delete(AUDIT_GROUP).catch(function () {
                            // a refusal is reported by the ErrorHandler
                        });
                        return oModel.submitBatch(AUDIT_GROUP);
                    }).then(function () {
                        if (oModel.hasPendingChanges(AUDIT_GROUP)) {
                            oModel.resetChanges(AUDIT_GROUP);
                        } else {
                            MessageToast.show(oBundle.getText("auditDeleted"));
                            this._onAuditsChanged();
                        }
                        oBinding.destroy();
                    }.bind(this));
                }.bind(this)
            });
        },

        /**
         * Adicionar follow-up: the owners offered are the project's active members.
         * @param {object} oRow the audit row
         * @private
         */
        _openFollowUp: function (oRow) {
            var oFollowUp = this.getModel("followUp"),
                oBinding = this.getOwnerComponent().getModel().bindList("/Projects(" + oRow.project_ID + ")/members",
                    undefined, [], [], { $expand: "person($select=ID,name)" });

            oFollowUp.setData({
                busy: false,
                title: this.getResourceBundle().getText("fuTitle", [oRow.code]),
                auditId: oRow.ID,
                errors: {},
                people: [],
                values: { name: "", owner_ID: null, date: null, description: "" }
            });
            oBinding.requestContexts(0, 1000).then(function (aContexts) {
                var mPeople = {};

                aContexts.map(function (oContext) {
                    return oContext.getObject();
                }).filter(function (oMember) {
                    return memberRules.isActive(oMember.endDate) && oMember.person;
                }).forEach(function (oMember) {
                    var oEntry = mPeople[oMember.person_ID] ||
                        (mPeople[oMember.person_ID] = { ID: oMember.person_ID, name: oMember.person.name, roles: [] });

                    oEntry.roles.push(formatter.roleText.call(this, oMember.role));
                }, this);
                oFollowUp.setProperty("/people", Object.keys(mPeople).map(function (sPersonId) {
                    return Object.assign({}, mPeople[sPersonId], { roles: mPeople[sPersonId].roles.join(", ") });
                }));
            }.bind(this)).finally(function () {
                oBinding.destroy();
            });
            this._getFollowUpDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * Projects and people for the audit dialog, read once.
         * @private
         */
        _loadAuditChoices: function () {
            var oAudit = this.getModel("audit");

            if (!oAudit.getProperty("/projects").length) {
                this._readRows("/Projects", { $select: "ID,code,name", $orderby: "code" }).then(function (aRows) {
                    oAudit.setProperty("/projects", aRows);
                });
            }
            if (!oAudit.getProperty("/people").length) {
                this._readRows("/People", { $select: "ID,name,email", $orderby: "name" }).then(function (aRows) {
                    oAudit.setProperty("/people", aRows);
                });
            }
        },

        /**
         * A project's milestones that require an audit (BR-10).
         * @param {string} sProjectId the project
         * @private
         */
        _loadAuditMilestones: function (sProjectId) {
            var oAudit = this.getModel("audit");

            oAudit.setProperty("/milestones", []);
            if (!sProjectId) {
                return;
            }
            // filtered here rather than with $filter: a project has a handful of milestones
            this._readRows("/Projects(" + sProjectId + ")/milestones", {
                $select: "ID,milestoneType,forecastEnd,status,requiresAudit", $orderby: "sortOrder"
            }).then(function (aRows) {
                oAudit.setProperty("/milestones", aRows.filter(function (oMilestone) {
                    return oMilestone.requiresAudit;
                }).map(function (oMilestone) {
                    return {
                        ID: oMilestone.ID,
                        label: formatter.milestoneTypeText.call(this, oMilestone.milestoneType) + " · " +
                            formatter.dateOrDash(oMilestone.forecastEnd)
                    };
                }, this));
            }.bind(this));
        },

        /**
         * @param {string} sPath an entity set or a collection under one
         * @param {object} mParameters query options, $orderby included
         * @returns {Promise<object[]>} the rows, none when the read fails
         * @private
         */
        _readRows: function (sPath, mParameters) {
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
         * The audit dialog, loaded once (Controller#loadFragment makes it a
         * dependent of the view, with the view's id prefix).
         * @returns {Promise<sap.m.Dialog>} the dialog
         * @private
         */
        _getAuditDialog: function () {
            if (!this._pAuditDialog) {
                this._pAuditDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.AuditDialog" });
            }
            return this._pAuditDialog;
        },

        /**
         * @returns {Promise<sap.m.Dialog>} the follow-up dialog, loaded once
         * @private
         */
        _getFollowUpDialog: function () {
            if (!this._pFollowUpDialog) {
                this._pFollowUpDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.FollowUpDialog" });
            }
            return this._pFollowUpDialog;
        }
    };
});
