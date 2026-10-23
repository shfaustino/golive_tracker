sap.ui.define([
    "./projectImportDialog",
    "./projectBulkDelete"
], function (projectImportDialog, projectBulkDelete) {
    "use strict";

    /**
     * The Projetos page's actions on many projects at once, mixed into
     * Projects.controller.js as one: Importar (./projectImportDialog) and
     * Eliminar selecionados (./projectBulkDelete).
     */
    return Object.assign({}, projectImportDialog, projectBulkDelete);
});
