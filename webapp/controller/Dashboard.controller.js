sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "sap/base/security/encodeXML",
    "../model/statusChart",
    "../model/monthChart",
    "../formatter/formatter"
], function (BaseController, JSONModel, Sorter, encodeXML, statusChart, monthChart, formatter) {
    "use strict";

    var DAY_MS = 86400000,
        RECENT_UPDATES = 5;

    /**
     * A Date as the API's Edm.Date (YYYY-MM-DD), in the browser's time zone.
     * @param {Date} oDate the date
     * @returns {string} YYYY-MM-DD
     */
    function toEdmDate(oDate) {
        return oDate.getFullYear() + "-" + String(oDate.getMonth() + 1).padStart(2, "0") + "-" +
            String(oDate.getDate()).padStart(2, "0");
    }

    return BaseController.extend("com.amt.golivetracker.controller.Dashboard", {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({
                busy: false, data: {}, kpi: {}, chart: { rows: [] }, overdue: [], stale: [], recent: [],
                donutHtml: "", barsHtml: "", period: null
            }), "dashboard");
            this.getRouter().getRoute("dashboard").attachPatternMatched(this._load, this);
        },

        /**
         * The period picker: the dashboard is read again for that range, or
         * for all time when the picker is cleared. Ignored while what was
         * typed is not a valid range.
         * @param {sap.ui.base.Event} oEvent change of the DateRangeSelection
         * @public
         */
        onPeriodChange: function (oEvent) {
            var oPicker = oEvent.getSource(),
                oFrom = oPicker.getDateValue(),
                oTo = oPicker.getSecondDateValue();

            if (oEvent.getParameter("valid") === false) {
                return;
            }
            this.getModel("dashboard").setProperty("/period", oFrom && oTo ? { from: toEdmDate(oFrom), to: toEdmDate(oTo) } : null);
            this._load();
        },

        /**
         * Opens the project a row is about (dashboard() rows and
         * RecentUpdates carry project_ID).
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
         * Reads dashboard(from, to) and the latest updates again on every
         * visit, so coming back shows today's numbers. A failed read leaves
         * its part empty; the ErrorHandler has already said why.
         * @private
         */
        _load: function () {
            var oViewModel = this.getModel("dashboard"),
                oPeriod = oViewModel.getProperty("/period"),
                oModel = this.getOwnerComponent().getModel(),
                oOperation = oModel.bindContext("/dashboard(...)"),
                oRecent = oModel.bindList("/RecentUpdates", undefined, [new Sorter("postedAt", true)], [], {
                    $select: "ID,project_ID,projectCode,projectName,authorName,postedAt,text,isAutomatic"
                });

            if (oPeriod) {
                oOperation.setParameter("from", oPeriod.from);
                oOperation.setParameter("to", oPeriod.to);
            }
            oViewModel.setProperty("/busy", true);
            Promise.all([
                oOperation.execute().then(function () {
                    return oOperation.getBoundContext().getObject();
                }).catch(function () {
                    return {};
                }),
                oRecent.requestContexts(0, RECENT_UPDATES).then(function (aContexts) {
                    return aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });
                }).catch(function () {
                    return [];
                })
            ]).then(function (aResults) {
                this._show(aResults[0], aResults[1]);
            }.bind(this)).finally(function () {
                oViewModel.setProperty("/busy", false);
                oOperation.destroy();
                oRecent.destroy();
            });
        },

        /**
         * Spreads one dashboard() answer and the latest updates over the page.
         * @param {object} oData the dashboard() answer
         * @param {object[]} aRecent RecentUpdates, newest first
         * @private
         */
        _show: function (oData, aRecent) {
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
            oViewModel.setProperty("/barsHtml", this._barsHtml(oData.projectsByMonth || []));

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
            oViewModel.setProperty("/recent", aRecent.map(function (oRow) {
                return Object.assign({}, oRow, {
                    summary: [oRow.text, oRow.authorName].filter(Boolean).join(" · ")
                });
            }));
        },

        /**
         * "Evolução dos projetos" as HTML: a bar pair per month on a ruled
         * axis. Every number in it is the app's own; the month names go
         * through encodeXML.
         * @param {object[]} aByMonth dashboard().projectsByMonth
         * @returns {string} the chart's HTML
         * @private
         */
        _barsHtml: function (aByMonth) {
            var oBundle = this.getResourceBundle(),
                oChart = monthChart.describe(aByMonth, oBundle.getText("monthsShortTitle").split(",")),
                // the ticks and their gridlines share one box, each placed
                // at its share of the height, so they always line up
                sTicks = oChart.ticks.map(function (iTick, i) {
                    var sBottom = (i * 100 / (oChart.ticks.length - 1)) + "%";

                    return "<span class=\"gtTick\" style=\"bottom:" + sBottom + "\">" + iTick + "</span>" +
                        "<span class=\"gtGridLine\" style=\"bottom:" + sBottom + "\"></span>";
                }).join(""),
                sColumns = oChart.months.map(function (oMonth) {
                    return "<div class=\"gtBarPair\">" +
                        "<span class=\"gtBar gtBarNew\" style=\"height:" + oMonth.createdPct + "%\" title=\"" +
                        encodeXML(oBundle.getText("dashboardNew") + ": " + oMonth.created) + "\"></span>" +
                        "<span class=\"gtBar gtBarClosed\" style=\"height:" + oMonth.closedPct + "%\" title=\"" +
                        encodeXML(oBundle.getText("dashboardClosed") + ": " + oMonth.closed) + "\"></span></div>";
                }).join(""),
                sLabels = oChart.months.map(function (oMonth) {
                    return "<span>" + encodeXML(oMonth.label) + "</span>";
                }).join("");

            if (!oChart.months.length) {
                return "<div class=\"gtBarsEmpty\">" + encodeXML(oBundle.getText("dashboardNoEvolution")) + "</div>";
            }
            return "<div class=\"gtBars\"><div class=\"gtBarsArea\">" + sTicks +
                "<div class=\"gtBarsPlot\">" + sColumns + "</div></div>" +
                "<div class=\"gtBarsLabels\">" + sLabels + "</div></div>";
        }
    });
});
