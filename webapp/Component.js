sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "./model/models",
    "./model/profiles",
    "./service/ErrorHandler"
], function (UIComponent, Device, models, profiles, ErrorHandler) {
    "use strict";

    return UIComponent.extend("com.amt.golivetracker.Component", {

        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this._oErrorHandler = new ErrorHandler(this);
            this.setModel(models.createDeviceModel(), "device");
            this.setModel(models.createUserModel(), "user");
            this.setModel(models.createAppModel(), "app");

            this._loadSignedInUser();
            this.getRouter().initialize();
        },

        destroy: function () {
            this._oErrorHandler.destroy();
            UIComponent.prototype.destroy.apply(this, arguments);
        },

        getContentDensityClass: function () {
            if (this._sContentDensityClass === undefined) {
                // eslint-disable-next-line @sap-ux/fiori-tools/sap-no-proprietary-browser-api, @sap-ux/fiori-tools/sap-browser-api-warning
                if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
                    this._sContentDensityClass = "";
                } else if (!Device.support.touch) {
                    this._sContentDensityClass = "sapUiSizeCompact";
                } else {
                    this._sContentDensityClass = "sapUiSizeCozy";
                }
            }
            return this._sContentDensityClass;
        },

        /**
         * Asks the API who is signed in (GET /project/me(), see
         * docs/backend-api-guide.md, "Quem é o utilizador") and fills the
         * "user" model with the person and what their profile may do. The
         * API checks every permission itself; this only shapes the UI (the
         * Administração entry, for one).
         *
         * A failed read leaves the user model as it started: signed in with no
         * known profile, which shows the least.
         * @private
         */
        _loadSignedInUser: function () {
            var oUserModel = this.getModel("user"),
                oOperation = this.getModel().bindContext("/me(...)");

            oOperation.execute().then(function () {
                var oMe = oOperation.getBoundContext().getObject();

                oUserModel.setData(Object.assign({
                    loaded: true,
                    id: oMe.ID,
                    name: oMe.name,
                    email: oMe.email,
                    profile: oMe.profile
                }, profiles.permissions(oMe.profile)));
            }).catch(function () {
                oUserModel.setProperty("/loaded", true);
            });
        }

    });

});
