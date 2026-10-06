sap.ui.define([
    "sap/ui/core/library",
    "../model/memberRules"
], function (coreLibrary, memberRules) {
    "use strict";

    var ValueState = coreLibrary.ValueState;

    /**
     * How each project status looks in a list (docs/mockups/03-projetos.png):
     * the i18n key of its label and the colour of its chip.
     */
    var PROJECT_STATUS = {
        NotStarted: { text: "statusNotStarted", state: ValueState.Information },
        InProgress: { text: "statusInProgress", state: ValueState.Success },
        OnHold: { text: "statusOnHold", state: ValueState.Warning },
        Replanning: { text: "statusReplanning", state: ValueState.Warning },
        Closing: { text: "statusClosing", state: ValueState.Information },
        Closed: { text: "statusClosed", state: ValueState.Success },
        Cancelled: { text: "statusCancelled", state: ValueState.Error }
    };

    /**
     * How each milestone status looks (docs/mockups/04-projeto-marcos.png).
     */
    var MILESTONE_STATUS = {
        Planned: { text: "msStatusPlanned", state: ValueState.None },
        InProgress: { text: "msStatusInProgress", state: ValueState.Information },
        Completed: { text: "msStatusCompleted", state: ValueState.Success },
        Postponed: { text: "msStatusPostponed", state: ValueState.Warning },
        NotApplicable: { text: "msStatusNotApplicable", state: ValueState.None },
        Cancelled: { text: "msStatusCancelled", state: ValueState.Error }
    };

    /**
     * The i18n key of each milestone type's label. The API's values carry
     * spaces and dashes ("Go-live", "Report delivery"), so they cannot be
     * i18n keys themselves.
     */
    var MILESTONE_TYPE = {
        "KO": "msTypeKO",
        "PTO": "msTypePTO",
        "GOP": "msTypeGOP",
        "Training": "msTypeTraining",
        "Testing": "msTypeTesting",
        "Go-live": "msTypeGoLive",
        "Report delivery": "msTypeReportDelivery",
        "Closure": "msTypeClosure"
    };

    /**
     * What each module code stands for. Product names, the same in every
     * language, so not in i18n.
     */
    var MODULE_NAMES = {
        "EC": "Employee Central",
        "ECP": "Employee Central Payroll",
        "TT": "Time Tracking",
        "P&G": "Performance & Goals",
        "REC": "Recruiting",
        "ONB": "Onboarding",
        "LMS": "Learning",
        "Compensation": "Compensation",
        "Workzone": "SAP Build Work Zone",
        "FI": "Financial Accounting",
        "SD": "Sales and Distribution",
        "EWM": "Extended Warehouse Management"
    };

    /**
     * The i18n key of each member role's label. The API's values carry
     * spaces ("Functional lead"), so they cannot be i18n keys themselves.
     */
    var ROLE = {
        "PM": "rolePM",
        "Functional lead": "roleFunctionalLead",
        "Technical lead": "roleTechnicalLead",
        "Testing owner": "roleTestingOwner",
        "Requirements owner": "roleRequirementsOwner",
        "Architect": "roleArchitect",
        "PMO": "rolePMO"
    };

    return {

        /**
         * The label of a project status, in the app's language. Formatters run
         * with the controller as "this", which is where the bundle comes from.
         * @param {string} sStatus the API's value, e.g. "InProgress"
         * @returns {string} the label, or the raw value when unknown
         */
        projectStatusText: function (sStatus) {
            var oEntry = PROJECT_STATUS[sStatus];

            return oEntry ? this.getResourceBundle().getText(oEntry.text) : (sStatus || "");
        },

        /**
         * The chip colour of a project status.
         * @param {string} sStatus the API's value
         * @returns {sap.ui.core.ValueState} the state
         */
        projectStatusState: function (sStatus) {
            return PROJECT_STATUS[sStatus] ? PROJECT_STATUS[sStatus].state : ValueState.None;
        },

        /**
         * The label of a milestone status.
         * @param {string} sStatus the API's value, e.g. "Completed"
         * @returns {string} the label, or the raw value when unknown
         */
        milestoneStatusText: function (sStatus) {
            var oEntry = MILESTONE_STATUS[sStatus];

            return oEntry ? this.getResourceBundle().getText(oEntry.text) : (sStatus || "");
        },

        /**
         * The chip text of a milestone: "Em atraso" when the API says it is
         * overdue (isOverdue, BR-07), its status otherwise.
         * @param {string} sStatus the API's value
         * @param {boolean} [bOverdue] the milestone's isOverdue
         * @returns {string} the label
         */
        milestoneStatusLabel: function (sStatus, bOverdue) {
            if (bOverdue) {
                return this.getResourceBundle().getText("msOverdue");
            }
            return MILESTONE_STATUS[sStatus] ? this.getResourceBundle().getText(MILESTONE_STATUS[sStatus].text) : (sStatus || "");
        },

        /**
         * The chip colour of a milestone status; an overdue milestone is red
         * whatever its status (isOverdue, BR-07).
         * @param {string} sStatus the API's value
         * @param {boolean} [bOverdue] the milestone's isOverdue
         * @returns {sap.ui.core.ValueState} the state
         */
        milestoneStatusState: function (sStatus, bOverdue) {
            if (bOverdue) {
                return ValueState.Error;
            }
            return MILESTONE_STATUS[sStatus] ? MILESTONE_STATUS[sStatus].state : ValueState.None;
        },

        /**
         * The label of a milestone type ("KO" -> "Kick-off").
         * @param {string} sType the API's milestoneType
         * @returns {string} the label, or the raw value when unknown
         */
        milestoneTypeText: function (sType) {
            return MILESTONE_TYPE[sType] ? this.getResourceBundle().getText(MILESTONE_TYPE[sType]) : (sType || "");
        },

        /**
         * An Edm.Date as the app shows dates, or a dash for none ("—" in the
         * mockup's empty "Data real").
         * @param {string} sDate YYYY-MM-DD, as the API sends it
         * @returns {string} DD/MM/YYYY, or "—"
         */
        dateOrDash: function (sDate) {
            var aParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sDate || "");

            return aParts ? aParts[3] + "/" + aParts[2] + "/" + aParts[1] : "—";
        },

        /**
         * The day of an ISO 8601 timestamp, as the app shows dates, in the
         * browser's time zone ("Última atualização").
         * @param {string} sTimestamp e.g. 2026-10-02T09:15:00Z
         * @returns {string} DD/MM/YYYY, or "—"
         */
        timestampDate: function (sTimestamp) {
            var oDate = sTimestamp ? new Date(sTimestamp) : null;

            if (!oDate || isNaN(oDate.getTime())) {
                return "—";
            }
            return String(oDate.getDate()).padStart(2, "0") + "/" + String(oDate.getMonth() + 1).padStart(2, "0") +
                "/" + oDate.getFullYear();
        },

        /**
         * A share as the legend shows it, with a decimal comma ("31,8%").
         * @param {number} fPct the percentage
         * @returns {string} the text
         */
        percent: function (fPct) {
            return typeof fPct === "number" ? String(fPct).replace(".", ",") + "%" : "";
        },

        /**
         * An amount with its currency, as Portugal writes it ("148 549,00 €").
         * @param {number|string} vValue the value (Edm.Decimal comes as a string)
         * @param {string} sCurrency ISO code, e.g. EUR
         * @returns {string} the text, or "—"
         */
        money: function (vValue, sCurrency) {
            var fValue = parseFloat(vValue);

            if (isNaN(fValue)) {
                return "—";
            }
            // Intl throws on anything that is not a three-letter code
            if (!/^[A-Z]{3}$/.test(sCurrency || "")) {
                return fValue.toFixed(2) + " " + (sCurrency || "");
            }
            return new Intl.NumberFormat("pt-PT", { style: "currency", currency: sCurrency }).format(fValue);
        },

        /**
         * How long a project runs, in months when it is long ("13 meses").
         * @param {string} sStart YYYY-MM-DD
         * @param {string} sEnd YYYY-MM-DD
         * @returns {string} the text, or "—"
         */
        duration: function (sStart, sEnd) {
            var iDays;

            if (!sStart || !sEnd) {
                return "—";
            }
            iDays = Math.round((Date.parse(sEnd) - Date.parse(sStart)) / 86400000);
            if (iDays >= 60) {
                return this.getResourceBundle().getText("durationMonths", [Math.round(iDays / 30.44)]);
            }
            return this.getResourceBundle().getText("durationDays", [iDays]);
        },

        /**
         * A timestamp with the time ("02/10/2026 09:15"), in the browser's time zone.
         * @param {string} sTimestamp ISO 8601
         * @returns {string} the text, or "—"
         */
        timestampDateTime: function (sTimestamp) {
            var oDate = sTimestamp ? new Date(sTimestamp) : null;

            if (!oDate || isNaN(oDate.getTime())) {
                return "—";
            }
            return String(oDate.getDate()).padStart(2, "0") + "/" + String(oDate.getMonth() + 1).padStart(2, "0") + "/" +
                oDate.getFullYear() + " " + String(oDate.getHours()).padStart(2, "0") + ":" +
                String(oDate.getMinutes()).padStart(2, "0");
        },

        /**
         * Who wrote something, and when ("Ana Silva · 02/10/2026").
         * @param {string} sName the author's name
         * @param {string} sTimestamp ISO 8601
         * @returns {string} the text
         */
        byline: function (sName, sTimestamp) {
            var sWhen = sTimestamp ? this.formatter.timestampDate(sTimestamp) : "";

            return [sName, sWhen].filter(Boolean).join(" · ");
        },

        /**
         * The full name of an SAP module code ("EC" -> "Employee Central").
         * @param {string} sModule the API's module
         * @returns {string} the name, or "" when it is already a name
         */
        moduleName: function (sModule) {
            return MODULE_NAMES[sModule] || "";
        },

        /**
         * How long ago something happened, as the mockup says it ("há 2
         * horas", "há 1 dia"); the date itself after a week.
         * @param {string} sTimestamp ISO 8601
         * @returns {string} the text
         */
        timeAgo: function (sTimestamp) {
            var oBundle = this.getResourceBundle(),
                iMinutes = sTimestamp ? Math.floor((Date.now() - Date.parse(sTimestamp)) / 60000) : NaN,
                iHours = Math.floor(iMinutes / 60),
                iDays = Math.floor(iHours / 24);

            if (isNaN(iMinutes)) {
                return "";
            }
            if (iMinutes < 1) {
                return oBundle.getText("agoNow");
            }
            if (iMinutes < 60) {
                return oBundle.getText(iMinutes === 1 ? "agoMinute" : "agoMinutes", [iMinutes]);
            }
            if (iHours < 24) {
                return oBundle.getText(iHours === 1 ? "agoHour" : "agoHours", [iHours]);
            }
            if (iDays < 7) {
                return oBundle.getText(iDays === 1 ? "agoDay" : "agoDays", [iDays]);
            }
            return this.formatter.timestampDate(sTimestamp);
        },

        /**
         * The label of an audit result.
         * @param {string} sResult Approved, ApprovedWithReservations or Rejected
         * @returns {string} the label
         */
        auditResultText: function (sResult) {
            return sResult ? this.getResourceBundle().getText("result" + sResult) : "";
        },

        /**
         * The chip colour of an audit result: approved green, with
         * reservations orange, rejected red.
         * @param {string} sResult the API's result
         * @returns {sap.ui.core.ValueState} the state
         */
        auditResultState: function (sResult) {
            return {
                Approved: ValueState.Success,
                ApprovedWithReservations: ValueState.Warning,
                Rejected: ValueState.Error
            }[sResult] || ValueState.None;
        },

        /**
         * An audit's follow-ups: "2 de 3 abertos", or "3 fechados" when none is open.
         * @param {number} iOpen open ones
         * @param {number} iTotal all of them
         * @returns {string} the text
         */
        followUpsText: function (iOpen, iTotal) {
            var oBundle = this.getResourceBundle();

            if (iOpen) {
                return oBundle.getText(iTotal === 1 ? "fuOpenOfOne" : "fuOpenOf", [iOpen, iTotal]);
            }
            return oBundle.getText(iTotal === 1 ? "fuAllClosedOne" : "fuAllClosed", [iTotal]);
        },

        /**
         * The label of an item type (Meeting, Document, Task, FollowUp).
         * @param {string} sType the API's type
         * @returns {string} the label
         */
        itemTypeText: function (sType) {
            return sType ? this.getResourceBundle().getText("itemType" + sType) : "";
        },

        /**
         * The chip text of an item: "Em atraso" when late, its status otherwise.
         * @param {string} sStatus ToDo, InProgress, Done or Cancelled
         * @param {boolean} bLate whether it is late
         * @returns {string} the label
         */
        itemStatusText: function (sStatus, bLate) {
            var oBundle = this.getResourceBundle();

            if (bLate) {
                return oBundle.getText("msOverdue");
            }
            return {
                ToDo: oBundle.getText("itemToDo"),
                InProgress: oBundle.getText("statusInProgress"),
                Done: oBundle.getText("itemDone"),
                Cancelled: oBundle.getText("statusCancelled")
            }[sStatus] || sStatus || "";
        },

        /**
         * The chip colour of an item, as in the mockup: late red, in progress
         * blue, done green, the rest grey.
         * @param {string} sStatus the API's status
         * @param {boolean} bLate whether it is late
         * @returns {sap.ui.core.ValueState} the state
         */
        itemStatusState: function (sStatus, bLate) {
            if (bLate) {
                return ValueState.Error;
            }
            return { InProgress: ValueState.Information, Done: ValueState.Success }[sStatus] || ValueState.None;
        },

        /**
         * "1 dia" or "n dias".
         * @param {number} iDays days
         * @returns {string} the text
         */
        daysText: function (iDays) {
            return this.getResourceBundle().getText(iDays === 1 ? "daysLateOne" : "daysLate", [iDays]);
        },

        /**
         * The day of a YYYY-MM-DD, two digits ("05"), for the date badges.
         * @param {string} sDate YYYY-MM-DD
         * @returns {string} the day
         */
        dayOfMonth: function (sDate) {
            return (sDate || "").slice(8, 10);
        },

        /**
         * The month of a YYYY-MM-DD, short and in capitals ("NOV").
         * @param {string} sDate YYYY-MM-DD
         * @returns {string} the month
         */
        monthShort: function (sDate) {
            var iMonth = Number((sDate || "").slice(5, 7));

            return iMonth ? this.getResourceBundle().getText("monthsShort").split(",")[iMonth - 1] : "";
        },

        /**
         * The label of a member role ("Functional lead" -> "Líder funcional").
         * @param {string} sRole the API's role
         * @returns {string} the label, or the raw value when unknown
         */
        roleText: function (sRole) {
            return ROLE[sRole] ? this.getResourceBundle().getText(ROLE[sRole]) : (sRole || "");
        },

        /**
         * "Ativo" or "Inativo", from the membership's end date.
         * @param {string|null} sEndDate the member's endDate
         * @returns {string} the label
         */
        memberStateText: function (sEndDate) {
            return this.getResourceBundle().getText(memberRules.isActive(sEndDate) ? "teamActive" : "teamInactive");
        },

        /**
         * The chip colour of a membership: green while it runs, red once ended.
         * @param {string|null} sEndDate the member's endDate
         * @returns {sap.ui.core.ValueState} the state
         */
        memberState: function (sEndDate) {
            return memberRules.isActive(sEndDate) ? ValueState.Success : ValueState.Error;
        },

        /**
         * Initials for an avatar: the first letter of the first and the last
         * name ("Marlon Teixeira" -> "MT").
         * @param {string} sName full name
         * @returns {string} one or two capital letters, or "" for no name
         */
        initials: function (sName) {
            var aParts = (sName || "").trim().split(/\s+/).filter(Boolean);

            if (!aParts.length) {
                return "";
            }
            return (aParts[0][0] + (aParts.length > 1 ? aParts[aParts.length - 1][0] : "")).toUpperCase();
        },

        /**
         * The profile's label under the person's name in the header.
         * @param {string} sProfile Administrator, Architect or User
         * @returns {string} the label
         */
        profileText: function (sProfile) {
            return sProfile ? this.getResourceBundle().getText("profile" + sProfile) : "";
        }
    };
});
