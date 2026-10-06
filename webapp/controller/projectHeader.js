sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/m/ActionSheet",
    "sap/m/Button",
    "sap/m/MessageToast",
    "../model/projectOverview",
    "../model/memberRules",
    "../formatter/formatter"
], function (Fragment, ActionSheet, Button, MessageToast, projectOverview, memberRules, formatter) {
    "use strict";

    /** The project statuses, in the order the status dialog offers them. */
    var STATUSES = ["NotStarted", "InProgress", "OnHold", "Replanning", "Closing", "Closed", "Cancelled"];

    /** The batch group a posted update goes in (updatesList's $$updateGroupId). */
    var UPDATE_GROUP = "updateEdit";

    /**
     * The project's header actions, Visão geral, Módulos and Updates.
     * Mixed into ProjectDetail.controller.js, so `this` is that controller.
     *
     * - "…" > Mudar estado: ProjectService.changeStatus { status, reason }.
     * - "…" > Gravar baseline: ProjectService.setBaseline { reason } (BR-06).
     * - Visão geral and Módulos read the "overview" model, filled by
     *   _loadOverview with the project's milestones, team, modules and
     *   latest updates.
     * - Updates: POST .../updates { text }; the API fills in the author.
     */
    return {

        /**
         * The "…" next to the status.
         * @param {sap.ui.base.Event} oEvent press of the button
         * @public
         */
        onProjectActions: function (oEvent) {
            var oBundle = this.getResourceBundle();

            if (!this._oProjectMenu) {
                this._oProjectMenu = new ActionSheet({
                    placement: "Bottom",
                    buttons: [
                        new Button({ text: oBundle.getText("actChangeStatus"), icon: "sap-icon://process", press: this._openStatusDialog.bind(this) }),
                        new Button({ text: oBundle.getText("actSetBaseline"), icon: "sap-icon://gantt-bars", press: this._openBaselineDialog.bind(this) })
                    ]
                });
                this.getView().addDependent(this._oProjectMenu);
            }
            this._oProjectMenu.openBy(oEvent.getSource());
        },

        /**
         * A "Ver …" link in Visão geral: opens the tab it names.
         * @param {sap.ui.base.Event} oEvent press of the link
         * @public
         */
        onGoToTab: function (oEvent) {
            this.getRouter().navTo("projectDetail", {
                projectId: this._sProjectId,
                tab: oEvent.getSource().data("tab")
            }, undefined, true);
        },

        onConfirmProjectAction: function () {
            var oActionModel = this.getModel("action"),
                sMode = oActionModel.getProperty("/mode"),
                oValues = oActionModel.getProperty("/values"),
                sReason = (oValues.reason || "").trim(),
                oBundle = this.getResourceBundle(),
                oAction;

            // A baseline replaces the previous one for good: say why.
            if (sMode === "baseline" && !sReason) {
                oActionModel.setProperty("/errors", { reason: oBundle.getText("actErrorReason") });
                return;
            }
            oActionModel.setProperty("/errors", {});
            oActionModel.setProperty("/busy", true);

            oAction = this.getOwnerComponent().getModel().bindContext(
                sMode === "status" ? "ProjectService.changeStatus(...)" : "ProjectService.setBaseline(...)",
                this.getView().getBindingContext());
            if (sMode === "status") {
                oAction.setParameter("status", oValues.status);
            }
            oAction.setParameter("reason", sReason);

            oAction.execute().then(function () {
                MessageToast.show(sMode === "status"
                    ? oBundle.getText("actStatusDone", [formatter.projectStatusText.call(this, oValues.status)])
                    : oBundle.getText("actBaselineDone"));
                this.onCancelProjectAction();
                // The status, the automatic update and the baselines are the
                // API's. The tables under the project have caches of their
                // own, which refreshing the project does not reach.
                this.getView().getElementBinding().refresh();
                this.byId("updatesList").getBinding("items").refresh();
                this.byId("milestonesTable").getBinding("items").refresh();
                this._loadOverview();
            }.bind(this)).catch(function () {
                // The ErrorHandler shows the API's reason (a 409 lists what is
                // still open); the dialog stays for another try.
            }).finally(function () {
                oActionModel.setProperty("/busy", false);
                oAction.destroy();
            });
        },

        onCancelProjectAction: function () {
            this._getActionDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * Publicar: POST .../updates with the text. On success the box
         * empties and the list and Visão geral show it.
         * @public
         */
        onPostUpdate: function () {
            var oOverview = this.getModel("overview"),
                sText = (oOverview.getProperty("/draft") || "").trim(),
                oModel = this.getOwnerComponent().getModel(),
                oList = this.byId("updatesList");

            if (!sText) {
                return;
            }
            oOverview.setProperty("/posting", true);
            oList.getBinding("items").create({ text: sText }, false);
            oModel.submitBatch(UPDATE_GROUP).then(function () {
                oOverview.setProperty("/posting", false);
                if (oModel.hasPendingChanges(UPDATE_GROUP)) {
                    oModel.resetChanges(UPDATE_GROUP);
                    return;
                }
                oOverview.setProperty("/draft", "");
                MessageToast.show(this.getResourceBundle().getText("updPosted"));
                // author and postedAt are the API's to fill in
                oList.getBinding("items").refresh();
                this._loadOverview();
            }.bind(this));
        },

        /**
         * Reads what Visão geral and Módulos show, all under the project:
         * milestones, active team, modules and the latest updates. Four
         * small reads, run together; a failed one leaves its part empty.
         * @private
         */
        _loadOverview: function () {
            var oOverview = this.getModel("overview"),
                oBundle = this.getResourceBundle(),
                sPath = "/Projects(" + this._sProjectId + ")",
                sToday = memberRules.today(),
                read = function (sNav, mParameters, iTop) {
                    var oBinding = this.getOwnerComponent().getModel().bindList(sPath + "/" + sNav, undefined, [], [], mParameters);

                    return oBinding.requestContexts(0, iTop || 1000).then(function (aContexts) {
                        return aContexts.map(function (oContext) {
                            return oContext.getObject();
                        });
                    }).catch(function () {
                        return [];
                    }).finally(function () {
                        oBinding.destroy();
                    });
                }.bind(this);

            Promise.all([
                read("milestones", { $orderby: "sortOrder" }),
                read("members", { $expand: "person($select=name)", $orderby: "startDate" }),
                read("modules", { $select: "module" }),
                read("updates", { $expand: "author($select=name)", $orderby: "postedAt desc" }, 3)
            ]).then(function (aResults) {
                var oProgress = projectOverview.describe(aResults[0], sToday),
                    oNext = oProgress.next,
                    sNextDays = "";

                if (oNext && oNext.days !== null) {
                    if (oNext.days < 0) {
                        sNextDays = oBundle.getText(oNext.days === -1 ? "daysLateOne" : "daysLate", [-oNext.days]);
                    } else if (oNext.days === 0) {
                        sNextDays = oBundle.getText("ovDueToday");
                    } else {
                        sNextDays = oBundle.getText(oNext.days === 1 ? "ovInDaysOne" : "ovInDays", [oNext.days]);
                    }
                }
                oOverview.setProperty("/progress", oProgress);
                // The bar's width is the app's own number; nothing else goes in the HTML.
                oOverview.setProperty("/progressBarHtml",
                    "<div class=\"gtProgressFill\" style=\"width:" + oProgress.pct + "%\"></div>");
                oOverview.setProperty("/progressText", oBundle.getText("ovProgressText", [oProgress.done, oProgress.total]));
                oOverview.setProperty("/nextDaysText", sNextDays);
                oOverview.setProperty("/team", aResults[1].filter(function (oMember) {
                    return memberRules.isActive(oMember.endDate);
                }));
                oOverview.setProperty("/modules", aResults[2]);
                oOverview.setProperty("/updates", aResults[3]);
            });
        },

        /** @private */
        _openStatusDialog: function () {
            var oBundle = this.getResourceBundle(),
                sCurrent = this.getView().getBindingContext().getProperty("status"),
                aStatuses = STATUSES.filter(function (sStatus) {
                    return sStatus !== sCurrent;
                }).map(function (sStatus) {
                    return { key: sStatus, text: formatter.projectStatusText.call(this, sStatus) };
                }, this);

            this._openActionDialog({
                mode: "status",
                title: oBundle.getText("actChangeStatus"),
                intro: oBundle.getText("actStatusIntro", [formatter.projectStatusText.call(this, sCurrent)]),
                confirmText: oBundle.getText("actChangeStatus"),
                statuses: aStatuses,
                values: { status: aStatuses[0] && aStatuses[0].key, reason: "" }
            });
        },

        /** @private */
        _openBaselineDialog: function () {
            var oBundle = this.getResourceBundle();

            this._openActionDialog({
                mode: "baseline",
                title: oBundle.getText("actSetBaseline"),
                intro: oBundle.getText("actBaselineIntro"),
                confirmText: oBundle.getText("actSetBaseline"),
                statuses: [],
                values: { reason: "" }
            });
        },

        /**
         * @param {object} oState the dialog's state
         * @private
         */
        _openActionDialog: function (oState) {
            this.getModel("action").setData(Object.assign({ busy: false, errors: {} }, oState));
            this._getActionDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * @returns {Promise<sap.m.Dialog>} the action dialog, loaded once
         * @private
         */
        _getActionDialog: function () {
            if (!this._pActionDialog) {
                this._pActionDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "com.amt.golivetracker.fragment.ProjectActionDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }
            return this._pActionDialog;
        }
    };
});
