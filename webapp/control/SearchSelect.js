sap.ui.define([
    "sap/m/ComboBox",
    "sap/m/ComboBoxRenderer"
], function (ComboBox, ComboBoxRenderer) {
    "use strict";

    /**
     * Whether an item matches what was typed: anywhere in its text or its
     * additional text, ignoring case ("sa" finds "Cerejeira SA").
     * @param {string} sTerm what was typed
     * @param {sap.ui.core.Item} oItem an item of the list
     * @returns {boolean} whether to show the item
     */
    function contains(sTerm, oItem) {
        var sLower = (sTerm || "").toLowerCase(),
            sAdditional = oItem.getAdditionalText ? oItem.getAdditionalText() : "";

        return (oItem.getText() || "").toLowerCase().indexOf(sLower) !== -1 ||
            (sAdditional || "").toLowerCase().indexOf(sLower) !== -1;
    }

    /**
     * The app's dropdown: a ComboBox that searches as one types, and takes only
     * what is in its list. Text that matches no item is dropped when it is
     * committed (Enter, leaving the field), so the field never shows a value
     * its selectedKey does not have.
     *
     * Listen to selectionChange (not change) for a new choice, and read it with
     * getSelectedKey(). For a filter, give it placeholder "Todos" and
     * showClearIcon instead of a "Todos" item: an empty field means all.
     */
    return ComboBox.extend("com.amt.golivetracker.control.SearchSelect", {
        metadata: {},

        renderer: ComboBoxRenderer,

        init: function () {
            ComboBox.prototype.init.apply(this, arguments);
            // a ListItem's additionalText (a project's name, a person's email) shows in the list
            this.setShowSecondaryValues(true);
            this.setFilterFunction(contains);
            this.attachChange(this._dropUnknownText, this);
        },

        /** @private */
        _dropUnknownText: function () {
            if (!this.getSelectedItem() && this.getValue()) {
                this.setValue("");
            }
        }
    });
});
