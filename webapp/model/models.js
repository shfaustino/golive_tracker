sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device",
    "./profiles"
], function (JSONModel, Device, profiles) {
    "use strict";

    return {

        /**
         * Device flags (phone/tablet/desktop, touch support) as a model, so
         * that views can react to them through bindings.
         * @returns {sap.ui.model.json.JSONModel} the device model
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        /**
         * The signed-in person, as GET /project/me() answers
         * (Component.js#_loadSignedInUser), plus what the profile may do.
         * Starts empty and with no permissions until that read answers.
         * @returns {sap.ui.model.json.JSONModel} id, name, email, profile and the profile's flags
         */
        createUserModel: function () {
            return new JSONModel(Object.assign({
                loaded: false,
                id: null,
                name: "",
                email: "",
                profile: null
            }, profiles.permissions(null)));
        },

        /**
         * App-wide state: the route the side navigation highlights, and
         * whether the side navigation is collapsed.
         * @returns {sap.ui.model.json.JSONModel} the "app" model
         */
        createAppModel: function () {
            return new JSONModel({
                route: "dashboard",
                sideExpanded: !Device.system.phone
            });
        }
    };
});
