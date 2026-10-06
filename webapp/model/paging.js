sap.ui.define([], function () {
    "use strict";

    /** How many page numbers the pager shows at most, around the current one. */
    var WINDOW = 5;

    return {

        /**
         * Everything a numbered pager needs (docs/mockups/03-projetos.png:
         * "A mostrar 1-10 de 24 projetos", ‹ 1 2 3 ›).
         * @param {number} iPage the page asked for, 1-based; kept within the pages there are
         * @param {number} iPageSize rows per page
         * @param {number} iTotal rows in all
         * @returns {{page: number, pageCount: number, from: number, to: number, total: number,
         *   pages: {n: number, current: boolean}[]}} the pager's state
         */
        describe: function (iPage, iPageSize, iTotal) {
            var iPageCount = Math.max(1, Math.ceil(iTotal / iPageSize)),
                iCurrent = Math.min(Math.max(1, iPage), iPageCount),
                iFirst = Math.max(1, Math.min(iCurrent - Math.floor(WINDOW / 2), iPageCount - WINDOW + 1)),
                iLast = Math.min(iPageCount, iFirst + WINDOW - 1),
                aPages = [],
                n;

            for (n = iFirst; n <= iLast; n += 1) {
                aPages.push({ n: n, current: n === iCurrent });
            }
            return {
                page: iCurrent,
                pageCount: iTotal ? iPageCount : 0,
                from: iTotal ? (iCurrent - 1) * iPageSize + 1 : 0,
                to: Math.min(iCurrent * iPageSize, iTotal),
                total: iTotal,
                pages: aPages
            };
        }
    };
});
