sap.ui.define([
    "./bulkDelete"
], function (bulkDelete) {
    "use strict";

    /**
     * Eliminar selecionados on the Projetos page (./bulkDelete), for
     * Administrators: the table is MultiSelect for them, and the API refuses
     * anyone else. DELETE /Projects(<id>) takes everything in the project.
     * Mixed into Projects.controller.js through ./projectListActions.
     */
    return Object.assign({}, bulkDelete, {

        /**
         * What ./bulkDelete works with on this page.
         * @returns {object} the setup
         * @private
         */
        _bulkSetup: function () {
            var oBundle = this.getResourceBundle(),
                oList = this.getModel("list");

            return {
                table: this.byId("projectsTable"),
                rowModel: "list",
                model: this.getOwnerComponent().getModel(),
                canDeactivate: false,
                texts: {
                    title: oBundle.getText("bulkTitle"),
                    intro: oBundle.getText("bulkIntro"),
                    codeLabel: oBundle.getText("colCode")
                },
                row: function (oProject) {
                    return { ID: oProject.ID, code: oProject.code, name: oProject.name };
                },
                path: function (oRow) {
                    return "/Projects(" + oRow.ID + ")";
                },
                setCount: function (iCount) {
                    oList.setProperty("/selectedCount", iCount);
                },
                done: function () {
                    // the lists that showed them read again
                    this.getOwnerComponent().getModel().refresh();
                    this._load(oList.getProperty("/page"));
                }.bind(this)
            };
        }
    });
});
