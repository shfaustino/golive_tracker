sap.ui.define([], function () {
    "use strict";

    /** The API takes only http(s) links in version 1 (BR-11; srv/handlers/attachments.js). */
    var LINK = /^https?:\/\/\S+$/i;

    return {

        DOCUMENT_TYPES: ["Proposal", "Contract", "Project plan", "Status report", "KO minutes", "GOP presentation",
            "Test plan", "Final report"],

        /**
         * What a list of attachments reads from GET /project/AllAttachments:
         * the project, milestone and item flattened in by the API, the
         * author's name, and the item's milestone (for the delete path).
         */
        QUERY: {
            $select: "ID,documentType,name,url,createdAt,project_ID,milestone_ID,milestoneItem_ID,projectID,projectCode," +
                "projectName,milestoneType,module,itemName",
            $expand: "author($select=name),milestoneItem($select=ID,milestone_ID)"
        },

        /**
         * Checks a new attachment before it is sent: a name, an http(s)
         * link, and the one owner it belongs to (the project, one of its
         * milestones, or one of a milestone's items).
         * @param {{name: string, url: string, owner: string, project_ID: string, milestone_ID: string,
         *   milestoneItem_ID: string}} oValues the form; owner is "project", "milestone" or "item"
         * @returns {Object<string, string>} per field, the i18n key of what is wrong
         */
        validate: function (oValues) {
            var oErrors = {};

            if (!(oValues.name || "").trim()) {
                oErrors.name = "pfErrorRequired";
            }
            if (!(oValues.url || "").trim()) {
                oErrors.url = "pfErrorRequired";
            } else if (!LINK.test(oValues.url.trim())) {
                oErrors.url = "attErrorLink";
            }
            if (!oValues.project_ID) {
                oErrors.project_ID = "pfErrorRequired";
            }
            // the API's table has documentType NOT NULL: without it the
            // refusal is a database error, not a message for the user
            if (!oValues.documentType) {
                oErrors.documentType = "pfErrorRequired";
            }
            if ((oValues.owner === "milestone" || oValues.owner === "item") && !oValues.milestone_ID) {
                oErrors.milestone_ID = "pfErrorRequired";
            }
            if (oValues.owner === "item" && !oValues.milestoneItem_ID) {
                oErrors.milestoneItem_ID = "pfErrorRequired";
            }
            return oErrors;
        },

        /**
         * Where a new attachment is POSTed: under its owner, as the API wants
         * it (/Projects(<id>)/attachments, .../milestones(<id>)/attachments
         * or .../items(<id>)/attachments).
         * @param {object} oValues the form, as validate takes it
         * @returns {string} the collection's path
         */
        collectionPath: function (oValues) {
            var sPath = "/Projects(" + oValues.project_ID + ")";

            if (oValues.owner === "milestone" || oValues.owner === "item") {
                sPath += "/milestones(" + oValues.milestone_ID + ")";
            }
            if (oValues.owner === "item") {
                sPath += "/items(" + oValues.milestoneItem_ID + ")";
            }
            return sPath + "/attachments";
        },

        /**
         * Where an existing attachment lives, for DELETE: under its owner.
         * @param {{ID: string, projectID: string, milestone_ID: string, milestoneItem_ID: string,
         *   itemMilestone_ID: string}} oRow a row of AllAttachments, flattened
         * @returns {string} the entity's path
         */
        entityPath: function (oRow) {
            var oValues = { project_ID: oRow.projectID, owner: "project" };

            if (oRow.milestoneItem_ID) {
                oValues.owner = "item";
                oValues.milestone_ID = oRow.itemMilestone_ID;
                oValues.milestoneItem_ID = oRow.milestoneItem_ID;
            } else if (oRow.milestone_ID) {
                oValues.owner = "milestone";
                oValues.milestone_ID = oRow.milestone_ID;
            }
            return this.collectionPath(oValues) + "(" + oRow.ID + ")";
        },

        /**
         * The body of a new attachment. The owner is in the path; the author
         * is the API's to fill in.
         * @param {object} oValues the form
         * @returns {object} the body
         */
        body: function (oValues) {
            var oBody = { name: oValues.name.trim(), url: oValues.url.trim() };

            if (oValues.documentType) {
                oBody.documentType = oValues.documentType;
            }
            return oBody;
        },

        /**
         * A row of AllAttachments for the table: the item's milestone pulled up
         * (needed for the delete path), and what the attachment hangs on.
         * @param {object} oAttachment as read with $expand=author,milestoneItem
         * @returns {object} the row
         */
        flatten: function (oAttachment) {
            var sOwner = "project";

            if (oAttachment.milestoneItem_ID) {
                sOwner = "item";
            } else if (oAttachment.milestone_ID) {
                sOwner = "milestone";
            }
            return Object.assign({}, oAttachment, {
                authorName: oAttachment.author ? oAttachment.author.name : "",
                itemMilestone_ID: oAttachment.milestoneItem ? oAttachment.milestoneItem.milestone_ID : null,
                owner: sOwner
            });
        }
    };
});
