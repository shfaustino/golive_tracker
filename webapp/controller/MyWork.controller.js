sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/myWork",
    "../model/memberRules",
    "../model/paging",
    "../formatter/formatter"
], function (BaseController, JSONModel, Filter, FilterOperator, myWork, memberRules, paging, formatter) {
    "use strict";

    /** Rows per page in As minhas tarefas, as in the mockup. */
    var PAGE_SIZE = 12;

    return BaseController.extend("com.amt.golivetracker.controller.MyWork", {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({
                busy: false, tab: "tarefas", term: "", state: "", pageNo: 1,
                items: [], page: [], pages: [], pageCount: 0, rangeText: "", tableTitle: "",
                kpi: { total: 0, inProgress: 0, late: 0, done: 0 }, late: [], upcoming: [],
                milestones: [], projects: []
            }), "work");
            this.getRouter().getRoute("myWork").attachPatternMatched(this._load, this);
        },

        onSearch: function (oEvent) {
            var sTerm = this.getSearchTermFromEvent(oEvent);

            this.applySearchFromEvent(oEvent, function () {
                this.getModel("work").setProperty("/term", sTerm);
                this._showPage(1);
            }.bind(this));
        },

        onStateChange: function () {
            this._showPage(1);
        },

        /**
         * "Ver todas" on Tarefas em atraso: the table, filtered to them.
         * @public
         */
        onShowLate: function () {
            this.getModel("work").setProperty("/state", "Late");
            this._showPage(1);
        },

        onPagePress: function (oEvent) {
            this._showPage(oEvent.getSource().getBindingContext("work").getProperty("n"));
        },

        onPagePrevious: function () {
            this._showPage(this.getModel("work").getProperty("/pageNo") - 1);
        },

        onPageNext: function () {
            this._showPage(this.getModel("work").getProperty("/pageNo") + 1);
        },

        /**
         * An item lives under a milestone of a project: open that project's
         * milestones.
         * @param {sap.ui.base.Event} oEvent press of a row or a link
         * @public
         */
        onOpenItem: function (oEvent) {
            this._openProject(oEvent.getSource().getBindingContext("work").getProperty("project_ID"), "marcos");
        },

        onOpenMilestone: function (oEvent) {
            this._openProject(oEvent.getSource().getBindingContext("work").getProperty("project_ID"), "marcos");
        },

        onOpenProject: function (oEvent) {
            this._openProject(oEvent.getSource().getBindingContext("work").getProperty("ID"), "visao-geral");
        },

        /**
         * @param {string} sProjectId the project
         * @param {string} sTab the tab to open it on
         * @private
         */
        _openProject: function (sProjectId, sTab) {
            if (sProjectId) {
                this.getRouter().navTo("projectDetail", { projectId: sProjectId, tab: sTab });
            }
        },

        /**
         * Reads the three lists again on every visit. The projects are those
         * where the person has a running membership: a lambda filter on
         * members, so it is the same for every profile (an Administrator
         * would otherwise see all of them).
         * @private
         */
        _load: function () {
            var oWork = this.getModel("work");

            oWork.setProperty("/busy", true);
            // The person's ID comes from me(), which may not have answered yet
            // when the app opens straight on this page.
            this.getOwnerComponent().pSignedInUser.then(this._read.bind(this));
        },

        /**
         * @private
         */
        _read: function () {
            var oWork = this.getModel("work"),
                sMe = this.getOwnerComponent().getModel("user").getProperty("/id"),
                sToday = memberRules.today(),
                aReads;

            aReads = [
                this._readAll("/MyItems", { $orderby: "date" }),
                this._readAll("/MyMilestones", { $orderby: "forecastEnd" }),
                sMe ? this._readAll("/Projects", {
                    $select: "ID,code,name,status",
                    $expand: "client($select=name),members($select=person_ID,role,endDate)"
                }, [new Filter({
                    path: "members",
                    operator: FilterOperator.Any,
                    variable: "m",
                    condition: new Filter("m/person_ID", FilterOperator.EQ, sMe)
                })]) : Promise.resolve([])
            ];

            Promise.all(aReads).then(function (aResults) {
                var oDescribed = myWork.describe(aResults[0], sToday);

                oWork.setProperty("/items", oDescribed.items);
                oWork.setProperty("/kpi", oDescribed.kpi);
                oWork.setProperty("/late", oDescribed.late);
                oWork.setProperty("/upcoming", oDescribed.upcoming);
                oWork.setProperty("/milestones", aResults[1]);
                oWork.setProperty("/projects", aResults[2].map(function (oProject) {
                    var aMine = (oProject.members || []).filter(function (oMember) {
                        return oMember.person_ID === sMe && memberRules.isActive(oMember.endDate);
                    });

                    return Object.assign({}, oProject, {
                        myRoles: aMine.map(function (oMember) {
                            return formatter.roleText.call(this, oMember.role);
                        }, this).join(", ")
                    });
                }, this).filter(function (oProject) {
                    return oProject.myRoles;
                }));
                this._showPage(1);
            }.bind(this)).finally(function () {
                oWork.setProperty("/busy", false);
            });
        },

        /**
         * One page of the items that match the search and the state.
         * @param {number} iPage 1-based
         * @private
         */
        _showPage: function (iPage) {
            var oWork = this.getModel("work"),
                oBundle = this.getResourceBundle(),
                aMatching = myWork.filter(oWork.getProperty("/items"), oWork.getProperty("/term"), oWork.getProperty("/state")),
                oPage = paging.describe(iPage, PAGE_SIZE, aMatching.length);

            oWork.setProperty("/page", aMatching.slice(oPage.from ? oPage.from - 1 : 0, oPage.to));
            oWork.setProperty("/pageNo", oPage.page);
            oWork.setProperty("/pageCount", oPage.pageCount);
            oWork.setProperty("/pages", oPage.pages);
            oWork.setProperty("/rangeText", oPage.total ? oBundle.getText("mwRange", [oPage.from, oPage.to, oPage.total]) : "");
            oWork.setProperty("/tableTitle", oBundle.getText("mwTableTitle", [aMatching.length]));
        },

        /**
         * Every row of an entity set, as plain objects; none when the read fails.
         * @param {string} sPath the entity set
         * @param {object} mParameters $select, $expand, $orderby
         * @param {sap.ui.model.Filter[]} [aFilters] filters
         * @returns {Promise<object[]>} the rows
         * @private
         */
        _readAll: function (sPath, mParameters, aFilters) {
            var oBinding = this.getOwnerComponent().getModel().bindList(sPath, undefined, [], aFilters || [], mParameters);

            return oBinding.requestContexts(0, 1000).then(function (aContexts) {
                return aContexts.map(function (oContext) {
                    return oContext.getObject();
                });
            }).catch(function () {
                return [];
            }).finally(function () {
                oBinding.destroy();
            });
        }
    });
});
