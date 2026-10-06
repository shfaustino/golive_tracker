sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Messaging"
], function (UI5Object, MessageBox, Filter, FilterOperator, Messaging) {
    "use strict";

    return UI5Object.extend("com.amt.golivetracker.service.ErrorHandler", {

        /**
         * Shows one dialog for every technical message the OData V4 models
         * raise, anywhere in the app. The API's messages are in English and
         * meant to be shown as they come (docs/backend-api-guide.md, "Erros"),
         * so the dialog carries them as its text. Wired once, from the
         * Component.
         * @param {sap.ui.core.UIComponent} oComponent the owning component
         */
        constructor: function (oComponent) {
            var oResourceBundle = oComponent.getModel("i18n").getResourceBundle();

            this._sTitle = oResourceBundle.getText("errorTitle");
            this._bDialogOpen = false;
            this._oMessageBinding = Messaging.getMessageModel().bindList("/", undefined,
                [], new Filter("technical", FilterOperator.EQ, true));

            // Kept in a field so destroy() can detach it.
            this._fnOnMessagesChanged = function (oEvent) {
                var aMessages = oEvent.getSource().getContexts().map(function (oContext) {
                    return oContext.getObject();
                });

                if (this._bDialogOpen || !aMessages.length) {
                    return;
                }
                Messaging.removeMessages(aMessages);
                this._show(aMessages[0].getMessage());
            };
            this._oMessageBinding.attachChange(this._fnOnMessagesChanged, this);
        },

        destroy: function () {
            this._oMessageBinding.detachChange(this._fnOnMessagesChanged, this);
            this._oMessageBinding.destroy();
            UI5Object.prototype.destroy.apply(this, arguments);
        },

        /**
         * One dialog at a time, so a burst of failed requests does not stack
         * a dialog per request.
         * @param {string} sText the API's message
         * @private
         */
        _show: function (sText) {
            this._bDialogOpen = true;
            MessageBox.error(sText, {
                title: this._sTitle,
                onClose: function () {
                    this._bDialogOpen = false;
                }.bind(this)
            });
        }
    });
});
