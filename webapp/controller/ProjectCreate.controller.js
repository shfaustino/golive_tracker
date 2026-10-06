sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "sap/m/MessageToast",
    "../model/projectForm",
    "../model/memberRules",
    "../formatter/formatter"
], function (BaseController, JSONModel, Sorter, MessageToast, projectForm, memberRules, formatter) {
    "use strict";

    /** The batch group the new project is sent in. */
    var CREATE_GROUP = "projectCreate";

    return BaseController.extend("com.amt.golivetracker.controller.ProjectCreate", {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel(this._emptyForm()), "form");
            this.getRouter().getRoute("projectCreate").attachPatternMatched(this._onRouteMatched, this);
        },

        /**
         * The type decides which milestones the API generates: shown on the right.
         * @public
         */
        onTypeChange: function () {
            var oForm = this.getModel("form");

            oForm.setProperty("/milestones", projectForm.milestonesFor(oForm.getProperty("/values/projectType")));
        },

        /**
         * Adicionar pessoas: an empty team row. The first row is the PM; the
         * API makes the creator the PM when no PM is named.
         * @public
         */
        onAddRow: function () {
            var oForm = this.getModel("form"),
                aMembers = oForm.getProperty("/values/members").slice(),
                bHasPm = aMembers.some(function (oMember) {
                    return oMember.role === "PM";
                });

            aMembers.push({ person_ID: null, profile: null, role: bHasPm ? "Functional lead" : "PM", startDate: null, error: null });
            oForm.setProperty("/values/members", aMembers);
        },

        /**
         * @param {sap.ui.base.Event} oEvent press of a row's delete button
         * @public
         */
        onRemoveRow: function (oEvent) {
            var oForm = this.getModel("form"),
                iIndex = Number(oEvent.getSource().getBindingContext("form").getPath().split("/").pop()),
                aMembers = oForm.getProperty("/values/members").slice();

            aMembers.splice(iIndex, 1);
            oForm.setProperty("/values/members", aMembers);
        },

        /**
         * A person was picked in a team row: show their profile next to them.
         * @param {sap.ui.base.Event} oEvent selectionChange of the row's ComboBox
         * @public
         */
        onRowPersonChange: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("form"),
                oItem = oEvent.getParameter("selectedItem"),
                oPerson = oItem && oItem.getBindingContext("form").getObject();

            this.getModel("form").setProperty(oContext.getPath() + "/profile", oPerson ? oPerson.profile : null);
        },

        onCancel: function () {
            this.getRouter().navTo("projects");
        },

        /**
         * Guardar: checks the form, then POST /project/Projects with the
         * modules and the team in one go. On success the new project opens;
         * a refusal (a code already used answers 409) leaves the form as it
         * was, with the API's reason shown by the ErrorHandler.
         * @public
         */
        onSave: function () {
            var oForm = this.getModel("form"),
                oValues = oForm.getProperty("/values"),
                oBundle = this.getResourceBundle(),
                oResult = projectForm.validate(oValues),
                oFieldErrors = {},
                oModel = this.getOwnerComponent().getModel(),
                oBinding,
                oContext;

            Object.keys(oResult.fields).forEach(function (sField) {
                oFieldErrors[sField] = oBundle.getText(oResult.fields[sField]);
            });
            oForm.setProperty("/errors", oFieldErrors);
            oForm.setProperty("/values/members", oValues.members.map(function (oMember, i) {
                return Object.assign({}, oMember, { error: oResult.members[i] ? oBundle.getText(oResult.members[i]) : null });
            }));
            if (Object.keys(oFieldErrors).length || Object.keys(oResult.members).length) {
                MessageToast.show(oBundle.getText("pfFixErrors"));
                return;
            }

            oForm.setProperty("/busy", true);
            oBinding = oModel.bindList("/Projects", undefined, [], [], { $$updateGroupId: CREATE_GROUP });
            oContext = oBinding.create(projectForm.payload(oValues));
            // A refusal is taken back by resetChanges below, which rejects
            // created() ("Request canceled"); that is expected, not an error.
            oContext.created().catch(function () {});
            oModel.submitBatch(CREATE_GROUP).then(function () {
                if (oModel.hasPendingChanges(CREATE_GROUP)) {
                    oModel.resetChanges(CREATE_GROUP);
                    oForm.setProperty("/busy", false);
                    oBinding.destroy();
                    return;
                }
                oContext.created().then(function () {
                    var sId = oContext.getProperty("ID");

                    oForm.setProperty("/busy", false);
                    MessageToast.show(oBundle.getText("pfCreated", [oValues.code.trim()]));
                    oBinding.destroy();
                    this.getRouter().navTo("projectDetail", { projectId: sId, tab: "visao-geral" }, undefined, true);
                }.bind(this));
            }.bind(this));
        },

        /**
         * Every visit starts from an empty form, with today as the start and
         * the signed-in person as the PM, and reads the choices once.
         * @private
         */
        _onRouteMatched: function () {
            var oForm = this.getModel("form"),
                oUser = this.getOwnerComponent().getModel("user"),
                oEmpty = this._emptyForm();

            ["clients", "people", "currencies"].forEach(function (sKey) {
                oEmpty[sKey] = oForm.getProperty("/" + sKey);
            });
            if (oUser.getProperty("/id")) {
                oEmpty.values.members = [{
                    person_ID: oUser.getProperty("/id"), profile: oUser.getProperty("/profile"),
                    role: "PM", startDate: null, error: null
                }];
            }
            oForm.setData(oEmpty);
            this._loadChoices();
        },

        /**
         * @returns {object} the "form" model's data for an empty form
         * @private
         */
        _emptyForm: function () {
            return {
                busy: false,
                errors: {},
                values: {
                    code: "", name: "", client_ID: null, projectType: null, externalCode: "", description: "",
                    startDate: memberRules.today(), endDate: null, value: "", currency_code: "EUR",
                    modules: [], members: []
                },
                milestones: [],
                clients: [],
                people: [],
                currencies: [],
                types: projectForm.PROJECT_TYPES.map(function (sType) {
                    return { key: sType, text: sType };
                }),
                modules: projectForm.MODULES.map(function (sModule) {
                    return { key: sModule, text: sModule, name: formatter.moduleName(sModule) };
                }),
                roles: memberRules.ROLES.map(function (sRole) {
                    return { key: sRole, text: formatter.roleText.call(this, sRole) };
                }, this)
            };
        },

        /**
         * Clients, people and currencies, each read once (the API lists only
         * active clients and people).
         * @private
         */
        _loadChoices: function () {
            var oForm = this.getModel("form"),
                oModel = this.getOwnerComponent().getModel(),
                read = function (sPath, sKey, mParameters, sSort, fnMap) {
                    var oBinding;

                    if ((oForm.getProperty("/" + sKey) || []).length) {
                        return;
                    }
                    oBinding = oModel.bindList(sPath, undefined, [new Sorter(sSort)], [], mParameters);
                    oBinding.requestContexts(0, 1000).then(function (aContexts) {
                        oForm.setProperty("/" + sKey, aContexts.map(function (oContext) {
                            return fnMap ? fnMap(oContext.getObject()) : oContext.getObject();
                        }));
                    }).catch(function () {
                        // the choice stays empty; the ErrorHandler has said why
                    }).finally(function () {
                        oBinding.destroy();
                    });
                };

            read("/Clients", "clients", { $select: "ID,name" }, "name");
            read("/People", "people", { $select: "ID,name,email,profile" }, "name");
            read("/Currencies", "currencies", {}, "code", function (oCurrency) {
                return { code: oCurrency.code, label: oCurrency.name ? oCurrency.code + " (" + oCurrency.name + ")" : oCurrency.code };
            });
        }
    });
});
