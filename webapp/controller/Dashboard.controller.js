sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../formatter/formatter"
], function (BaseController, JSONModel, formatter) {
    "use strict";

    return BaseController.extend("com.amt.golivetracker.controller.Dashboard", {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({ busy: false, data: {}, kpis: [] }), "dashboard");
            this.getRouter().getRoute("dashboard").attachPatternMatched(this._load, this);
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
                var oData = oOperation.getBoundContext().getObject();

                oViewModel.setProperty("/data", oData);
                oViewModel.setProperty("/kpis", this._kpis(oData.projectsByStatus || []));
            }.bind(this)).catch(function () {
                oViewModel.setProperty("/data", {});
                oViewModel.setProperty("/kpis", []);
            }).finally(function () {
                oViewModel.setProperty("/busy", false);
            });
        },

        /**
         * One tile for the total and one per status that has projects.
         * @param {{status: string, count: number}[]} aByStatus projectsByStatus
         * @returns {{label: string, count: number}[]} the tiles
         * @private
         */
        _kpis: function (aByStatus) {
            var iTotal = aByStatus.reduce(function (iSum, oRow) {
                return iSum + oRow.count;
            }, 0);

            return [{ label: this.getResourceBundle().getText("navProjects"), count: iTotal }].concat(
                aByStatus.map(function (oRow) {
                    return { label: formatter.projectStatusText.call(this, oRow.status), count: oRow.count };
                }, this));
        }
    });
});
