sap.ui.define([], function () {
    "use strict";

    /**
     * A header as it is matched: what comes before "(", no "*", no accents,
     * no case, no spaces.
     * @param {*} vText the header
     * @returns {string} the key
     */
    function headerKey(vText) {
        return String(vText || "").split("(")[0].replace(/\*/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "")
            .toLowerCase().replace(/\s+/g, "");
    }

    /**
     * @param {*} vValue a cell
     * @returns {string} its text, trimmed
     */
    function text(vValue) {
        return vValue === null || vValue === undefined ? "" : String(vValue).trim();
    }

    /**
     * A name, an email or a NIF as compared: trimmed, lower case.
     * @param {*} vValue the value
     * @returns {string} the key
     */
    function same(vValue) {
        return text(vValue).toLowerCase();
    }

    return {

        headerKey: headerKey,

        text: text,

        same: same,

        /**
         * The values already taken (codes, emails, names, NIFs), to tell a row
         * that repeats one.
         * @param {string[]} [aValues] the values
         * @returns {Object<string, string>} per value (as same() gives it), "taken"
         */
        taken: function (aValues) {
            var mSeen = {};

            (aValues || []).forEach(function (sValue) {
                if (sValue) {
                    mSeen[same(sValue)] = "taken";
                }
            });
            return mSeen;
        },

        /**
         * A value that must be unique: already taken, or repeated in the file;
         * a new one is noted in mSeen.
         * @param {string} sValue the row's value
         * @param {Object<string, string>} mSeen the values seen: "taken" (already there) or "file" (an earlier row)
         * @param {string} sField the field, for the error
         * @param {string} sTakenKey i18n key when already taken
         * @param {string} sRepeatedKey i18n key when an earlier row has it
         * @returns {{field: string, key: string, value: string}[]} the error, if any
         */
        uniqueErrors: function (sValue, mSeen, sField, sTakenKey, sRepeatedKey) {
            var sSeen = mSeen[same(sValue)];

            if (!sValue) {
                return [];
            }
            if (!sSeen) {
                mSeen[same(sValue)] = "file";
                return [];
            }
            return [{ field: sField, key: sSeen === "taken" ? sTakenKey : sRepeatedKey, value: sValue }];
        },

        /**
         * The template's header row.
         * @param {Array[]} aColumns [key, header] per column
         * @returns {string[]} the headers
         */
        headers: function (aColumns) {
            return aColumns.map(function (aColumn) {
                return aColumn[1];
            });
        },

        /**
         * The filled rows of a sheet (headers first), each with a reader of
         * its cells by column key: columns are found by their header, so they
         * may come in any order, and the ones not known are ignored.
         * @param {Array[]} aSheet the sheet, a row per array
         * @param {Array[]} aColumns [key, header] per column
         * @returns {{line: number, cell: function(string): *}[]} the rows; line is the sheet's (the headers are 1)
         */
        rows: function (aSheet, aColumns) {
            var aHeaders = (aSheet[0] || []).map(headerKey),
                mColumn = {};

            aColumns.forEach(function (aColumn) {
                mColumn[aColumn[0]] = aHeaders.indexOf(headerKey(aColumn[1]));
            });
            return aSheet.slice(1).map(function (aRow, i) {
                var aCells = aRow || [];

                return {
                    line: i + 2,
                    cells: aCells,
                    cell: function (sKey) {
                        return mColumn[sKey] === undefined || mColumn[sKey] === -1 ? "" : aCells[mColumn[sKey]];
                    }
                };
            }).filter(function (oRow) {
                return oRow.cells.some(function (vCell) {
                    return text(vCell) !== "";
                });
            });
        }
    };
});
