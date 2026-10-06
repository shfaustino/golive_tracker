sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/ui/model/Sorter",
    "sap/m/ActionSheet",
    "sap/m/Button",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../model/memberRules",
    "../formatter/formatter"
], function (Fragment, Sorter, ActionSheet, Button, MessageBox, MessageToast, memberRules, formatter) {
    "use strict";

    /** The batch group team changes are sent in (membersTable's $$updateGroupId). */
    var TEAM_GROUP = "memberEdit";

    /**
     * The Equipa tab of a project (docs/mockups/05-projeto-equipa.png),
     * US-10, US-11, BR-03. Mixed into ProjectDetail.controller.js, so `this`
     * is that controller: these are its handlers for the tab, kept apart
     * only to keep the file readable.
     *
     * - Adicionar membro: POST .../members (any role but PM).
     * - Editar: PATCH .../members(<id>) with what changed.
     * - Terminar hoje: PATCH endDate = today, which keeps the history.
     * - Remover: DELETE .../members(<id>).
     * - Passar testemunho (on the active PM): ProjectService.handOverPM, which
     *   ends the current PM and starts the new one; the only way to change PM.
     */
    return {

        onAddMember: function () {
            this._openMemberDialog({
                mode: "add",
                title: this.getResourceBundle().getText("teamAddTitle"),
                values: { person_ID: null, role: null, startDate: memberRules.today(), endDate: null }
            });
        },

        /**
         * The row's "…": the actions that apply to that membership.
         * @param {sap.ui.base.Event} oEvent press of the row's button
         * @public
         */
        onMemberActions: function (oEvent) {
            var oButton = oEvent.getSource(),
                oContext = oButton.getBindingContext(),
                oMember = oContext.getObject(),
                oBundle = this.getResourceBundle(),
                bActive = memberRules.isActive(oMember.endDate),
                bActivePm = bActive && oMember.role === "PM",
                aButtons = [
                    new Button({ text: oBundle.getText("teamEdit"), icon: "sap-icon://edit", press: this._editMember.bind(this, oContext) })
                ];

            if (bActivePm) {
                aButtons.push(new Button({
                    text: oBundle.getText("teamHandOver"), icon: "sap-icon://journey-change", press: this._handOverPm.bind(this, oContext)
                }));
            } else {
                if (bActive) {
                    aButtons.push(new Button({
                        text: oBundle.getText("teamEndToday"), icon: "sap-icon://past", press: this._endMemberToday.bind(this, oContext)
                    }));
                }
                aButtons.push(new Button({
                    text: oBundle.getText("teamRemove"), icon: "sap-icon://delete", type: "Reject", press: this._removeMember.bind(this, oContext)
                }));
            }

            if (this._oMemberMenu) {
                this._oMemberMenu.destroy();
            }
            this._oMemberMenu = new ActionSheet({ placement: "Bottom", buttons: aButtons });
            this.getView().addDependent(this._oMemberMenu);
            this._oMemberMenu.openBy(oButton);
        },

        /**
         * Guardar / Passar testemunho in the dialog.
         * @public
         */
        onSaveMember: function () {
            var oMemberModel = this.getModel("member"),
                oValues = Object.assign({ mode: oMemberModel.getProperty("/mode") }, oMemberModel.getProperty("/values")),
                oBundle = this.getResourceBundle(),
                oKeys = memberRules.validate(oValues),
                oErrors = {};

            Object.keys(oKeys).forEach(function (sField) {
                oErrors[sField] = oBundle.getText(oKeys[sField]);
            });
            oMemberModel.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }

            oMemberModel.setProperty("/busy", true);
            ({
                add: this._sendNewMember,
                edit: this._sendMemberChanges,
                handover: this._sendHandOver
            })[oValues.mode].call(this, oValues).then(function (bDone) {
                oMemberModel.setProperty("/busy", false);
                if (bDone) {
                    this.onCancelMember();
                }
            }.bind(this));
        },

        onCancelMember: function () {
            this._getMemberDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * @param {sap.ui.model.odata.v4.Context} oContext the membership
         * @private
         */
        _editMember: function (oContext) {
            var oMember = oContext.getObject();

            this._oMemberContext = oContext;
            this._openMemberDialog({
                mode: "edit",
                title: this.getResourceBundle().getText("teamEditTitle"),
                personName: oMember.person && oMember.person.name,
                values: { role: oMember.role, startDate: oMember.startDate, endDate: oMember.endDate || null }
            });
        },

        /**
         * @param {sap.ui.model.odata.v4.Context} oContext the active PM's membership
         * @private
         */
        _handOverPm: function (oContext) {
            var oMember = oContext.getObject();

            this._openMemberDialog({
                mode: "handover",
                title: this.getResourceBundle().getText("teamHandoverTitle"),
                handoverNote: this.getResourceBundle().getText("teamHandoverNote", [oMember.person && oMember.person.name]),
                values: { person_ID: null, startDate: memberRules.today() }
            });
        },

        /**
         * Ends a membership today: it stays in the history, as Inativo from
         * tomorrow.
         * @param {sap.ui.model.odata.v4.Context} oContext the membership
         * @private
         */
        _endMemberToday: function (oContext) {
            this._oMemberContext = oContext;
            this._sendMemberChanges({ endDate: memberRules.today() }, true);
        },

        /**
         * Asks first: removing loses the history, ending keeps it.
         * @param {sap.ui.model.odata.v4.Context} oContext the membership
         * @private
         */
        _removeMember: function (oContext) {
            var oMember = oContext.getObject(),
                oBundle = this.getResourceBundle(),
                oModel = this.getOwnerComponent().getModel();

            MessageBox.confirm(oBundle.getText("teamRemoveConfirm", [
                oMember.person && oMember.person.name, formatter.roleText.call(this, oMember.role)
            ]), {
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    oContext.delete(TEAM_GROUP).catch(function () {
                        // a refusal is reported by the ErrorHandler; resetChanges below brings the row back
                    });
                    oModel.submitBatch(TEAM_GROUP).then(function () {
                        if (oModel.hasPendingChanges(TEAM_GROUP)) {
                            oModel.resetChanges(TEAM_GROUP);
                            return;
                        }
                        MessageToast.show(oBundle.getText("teamRemoved"));
                    });
                }
            });
        },

        /**
         * POST .../members.
         * @param {object} oValues the dialog's values
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _sendNewMember: function (oValues) {
            this.byId("membersTable").getBinding("items").create({
                person_ID: oValues.person_ID,
                role: oValues.role,
                startDate: oValues.startDate,
                endDate: oValues.endDate || null
            }, true);
            return this._submitTeam(this.getResourceBundle().getText("teamSaved"));
        },

        /**
         * PATCH .../members(<id>) with what changed.
         * @param {object} oValues the new values
         * @param {boolean} [bAll] send every field given, not only those that differ
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _sendMemberChanges: function (oValues, bAll) {
            var oContext = this._oMemberContext,
                oBefore = oContext.getObject(),
                aFields = ["role", "startDate", "endDate"].filter(function (sField) {
                    return sField in oValues && (bAll || (oValues[sField] || null) !== (oBefore[sField] || null));
                });

            if (!aFields.length) {
                return Promise.resolve(true);
            }
            aFields.forEach(function (sField) {
                oContext.setProperty(sField, oValues[sField] || null, TEAM_GROUP).catch(function () {
                    // settled with the batch; handled once in _submitTeam
                });
            });
            return this._submitTeam(this.getResourceBundle().getText("teamSaved"));
        },

        /**
         * POST /Projects(<id>)/ProjectService.handOverPM, then reads the team
         * and the header again: both the old and the new PM changed.
         * @param {object} oValues the new PM and the start
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _sendHandOver: function (oValues) {
            var oAction = this.getOwnerComponent().getModel().bindContext(
                    "ProjectService.handOverPM(...)", this.getView().getBindingContext()),
                oPerson = this.getModel("member").getProperty("/people").find(function (oCandidate) {
                    return oCandidate.ID === oValues.person_ID;
                });

            oAction.setParameter("person_ID", oValues.person_ID);
            oAction.setParameter("startDate", oValues.startDate);
            return oAction.execute().then(function () {
                MessageToast.show(this.getResourceBundle().getText("teamHandedOver", [oPerson ? oPerson.name : ""]));
                this.getView().getElementBinding().refresh();
                return true;
            }.bind(this)).catch(function () {
                // the ErrorHandler shows the API's reason; the dialog stays open
                return false;
            }).finally(function () {
                oAction.destroy();
            });
        },

        /**
         * Sends the team group and tells whether it all went through. A
         * refusal is taken back whole, so the table shows what the API holds.
         * @param {string} sDoneText the toast on success
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _submitTeam: function (sDoneText) {
            var oModel = this.getOwnerComponent().getModel();

            return oModel.submitBatch(TEAM_GROUP).then(function () {
                if (oModel.hasPendingChanges(TEAM_GROUP)) {
                    oModel.resetChanges(TEAM_GROUP);
                    return false;
                }
                MessageToast.show(sDoneText);
                // "Ativo"/"Inativo" and the PM in the header may have moved.
                this.getView().getElementBinding().refresh();
                return true;
            }.bind(this));
        },

        /**
         * Opens the team dialog with the given state, after making sure the
         * people to choose from are there.
         * @param {object} oState mode, title and values
         * @private
         */
        _openMemberDialog: function (oState) {
            var oMemberModel = this.getModel("member");

            oMemberModel.setData(Object.assign({
                busy: false,
                errors: {},
                people: oMemberModel.getProperty("/people") || [],
                roles: memberRules.assignableRoles(oState.values.role).map(function (sRole) {
                    return { key: sRole, text: formatter.roleText.call(this, sRole) };
                }, this)
            }, oState));
            this._loadPeople();
            this._getMemberDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * The active people, read once (GET /project/People lists only active ones).
         * @private
         */
        _loadPeople: function () {
            var oMemberModel = this.getModel("member"),
                oBinding;

            if (this._bPeopleLoaded) {
                return;
            }
            this._bPeopleLoaded = true;
            oBinding = this.getOwnerComponent().getModel().bindList("/People", undefined,
                [new Sorter("name")], [], { $select: "ID,name,email" });
            oBinding.requestContexts(0, 1000).then(function (aContexts) {
                oMemberModel.setProperty("/people", aContexts.map(function (oContext) {
                    return oContext.getObject();
                }));
            }).catch(function () {
                this._bPeopleLoaded = false;
            }.bind(this)).finally(function () {
                oBinding.destroy();
            });
        },

        /**
         * @returns {Promise<sap.m.Dialog>} the team dialog, loaded once
         * @private
         */
        _getMemberDialog: function () {
            if (!this._pMemberDialog) {
                this._pMemberDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "com.amt.golivetracker.fragment.MemberDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }
            return this._pMemberDialog;
        }
    };
});
