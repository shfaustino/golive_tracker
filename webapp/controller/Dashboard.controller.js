sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/base/security/encodeXML",
    "../model/statusChart",
    "../formatter/formatter"
], function (BaseController, JSONModel, encodeXML, statusChart, formatter) {
    "use strict";

    var DAY_MS = 86400000;

    return BaseController.extend("com.amt.golivetracker.controller.Dashboard", {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({ busy: false, data: {}, kpi: {}, chart: { rows: [] }, overdue: [], stale: [] }), "dashboard");
            this.getRouter().getRoute("dashboard").attachPatternMatched(this._load, this);
        },

        /**
         * Opens the project a row is about. dashboard() rows carry the
         * project's code; when they also carry its ID the project opens
         * directly, otherwise Projetos opens searched by the code.
         * @param {sap.ui.base.Event} oEvent press of a row or of its code
         * @public
         */
        onOpenProject: function (oEvent) {
            var oRow = oEvent.getSource().getBindingContext("dashboard").getObject();

            if (oRow.project_ID) {
                this.getRouter().navTo("projectDetail", { projectId: oRow.project_ID });
            } else {
                this.getOwnerComponent().getModel("app").setProperty("/globalSearch", oRow.projectCode);
                this.getRouter().navTo("projects");
            }
        },

        onSeeAllProjects: function () {
            this.getRouter().navTo("projects");
        },

        /**
         * Reads GET /project/dashboard() again on every visit, so coming back
         * shows today's numbers. A failed read leaves the page empty; the
         * ErrorHandler has already said why.
         * @private
         */
        _load: function () {
            var oViewModel = this.getModel("dashboard"),
                oOperation = this.getOwnerComponent().getModel().bindContext("/dashboard(...)");

            oViewModel.setProperty("/busy", true);
            oOperation.execute().then(function () {
                this._show(oOperation.getBoundContext().getObject());
            }.bind(this)).catch(function () {
                this._show({});
            }.bind(this)).finally(function () {
                oViewModel.setProperty("/busy", false);
            });
        },

        /**
         * Spreads one dashboard() answer over the page's model.
         * @param {object} oData the answer
         * @private
         */
        _show: function (oData) {
            var oViewModel = this.getModel("dashboard"),
                oBundle = this.getResourceBundle(),
                aByStatus = oData.projectsByStatus || [],
                oChart = statusChart.describe(aByStatus),
                count = function (sStatus) {
                    return aByStatus.filter(function (oRow) {
                        return oRow.status === sStatus;
                    }).reduce(function (iSum, oRow) {
                        return iSum + oRow.count;
                    }, 0);
                },
                iNow = Date.now();

            oViewModel.setProperty("/data", oData);
            oViewModel.setProperty("/kpi", {
                total: oChart.total,
                inProgress: count("InProgress"),
                toReview: (oData.projectsToReview || []).length,
                closed: count("Closed")
            });
            oViewModel.setProperty("/chart", oChart);
            // The gradient and the total are the app's own numbers and colours;
            // the label goes through encodeXML all the same.
            oViewModel.setProperty("/donutHtml",
                "<div class=\"gtDonut\" style=\"background:" + oChart.gradient + "\">" +
                "<div class=\"gtDonutCenter\"><strong>" + oChart.total + "</strong><span>" +
                encodeXML(oBundle.getText("dashboardProjectsWord")) + "</span></div></div>");

            oViewModel.setProperty("/overdueCount", (oData.overdueMilestones || []).length);
            oViewModel.setProperty("/overdue", (oData.overdueMilestones || []).map(function (oRow) {
                var iDays = Math.max(1, Math.floor((iNow - Date.parse(oRow.dueDate)) / DAY_MS));

                return Object.assign({}, oRow, {
                    milestoneLabel: formatter.milestoneTypeText.call(this, oRow.milestoneType) + " · " +
                        formatter.dateOrDash(oRow.dueDate),
                    lateText: oBundle.getText(iDays === 1 ? "daysLateOne" : "daysLate", [iDays])
                });
            }, this));
            oViewModel.setProperty("/stale", (oData.staleProjects || []).map(function (oRow) {
                var iDays = oRow.lastUpdateAt ? Math.floor((iNow - Date.parse(oRow.lastUpdateAt)) / DAY_MS) : null;

                return Object.assign({}, oRow, {
                    agoText: iDays === null ? "" : oBundle.getText("daysAgo", [iDays])
                });
            }));
        }
    });
});
