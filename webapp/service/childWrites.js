sap.ui.define([
    "sap/m/MessageBox"
], function (MessageBox) {
    "use strict";

    /**
     * Changes and deletions of what lives under a project: milestones,
     * members, updates, attachments.
     *
     * The API takes them only under their parent
     * (/Projects(<id>)/milestones(<id>)); a direct /Milestones(<id>) answers
     * 405 ("not explicitly exposed"), as the guide says ("Entidades filhas
     * acedem-se pelo pai"). The OData V4 model, though, sends a PATCH or a
     * DELETE to an entity's canonical path, and the API's $metadata gives
     * those entities sets of their own: /Milestones(<id>). So these few
     * writes go out here, as plain requests to the parent's path, and the
     * caller reads its list again afterwards. Creating needs none of this
     * (a POST goes to the collection under the parent already), but a POST
     * may come here too where no list binding is at hand (a module).
     *
     * The CSRF token is fetched once (the approuter's, on BTP; none locally)
     * and fetched again when it has expired.
     */
    var sToken = null;

    /**
     * @param {string} sServiceUrl the service root, e.g. /project/
     * @returns {Promise<string|null>} the token, or null where none is needed
     */
    function fetchToken(sServiceUrl) {
        return fetch(sServiceUrl, { method: "HEAD", credentials: "same-origin", headers: { "X-CSRF-Token": "Fetch" } })
            .then(function (oResponse) {
                sToken = oResponse.headers.get("X-CSRF-Token");
                return sToken;
            })
            .catch(function () {
                return null;
            });
    }

    /**
     * The API's own message for a refusal: "error.message", and the first
     * of "error.details" when there are several.
     * @param {Response} oResponse the refusal
     * @returns {Promise<string>} the message
     */
    function messageOf(oResponse) {
        return oResponse.json().then(function (oBody) {
            var oError = oBody && oBody.error || {};

            return oError.message || (oError.details && oError.details[0] && oError.details[0].message) || oResponse.statusText;
        }).catch(function () {
            return oResponse.status + " " + oResponse.statusText;
        });
    }

    /**
     * @param {string} sServiceUrl the service root
     * @param {string} sMethod PATCH or DELETE
     * @param {string} sPath path under the root, starting with /
     * @param {object} [oBody] the fields to change
     * @param {boolean} [bRetried] whether this is the retry with a fresh token
     * @returns {Promise<Response>} the answer
     */
    function send(sServiceUrl, sMethod, sPath, oBody, bRetried) {
        var oHeaders = { "Accept": "application/json" };

        if (oBody) {
            oHeaders["Content-Type"] = "application/json";
        }
        if (sToken) {
            oHeaders["X-CSRF-Token"] = sToken;
        }
        return fetch(sServiceUrl.replace(/\/$/, "") + sPath, {
            method: sMethod,
            credentials: "same-origin",
            headers: oHeaders,
            body: oBody ? JSON.stringify(oBody) : undefined
        }).then(function (oResponse) {
            var bTokenRefused = oResponse.status === 403 &&
                (oResponse.headers.get("X-CSRF-Token") || "").toLowerCase() === "required";

            if (bTokenRefused && !bRetried) {
                return fetchToken(sServiceUrl).then(function () {
                    return send(sServiceUrl, sMethod, sPath, oBody, true);
                });
            }
            return oResponse;
        });
    }

    return {

        /**
         * Sends a PATCH or a DELETE to a path under a parent, and shows the
         * API's message when it refuses.
         * @param {sap.ui.model.odata.v4.ODataModel} oModel the model of the service
         * @param {string} sMethod PATCH or DELETE
         * @param {string} sPath e.g. /Projects(<id>)/milestones(<id>)
         * @param {object} [oBody] the fields to change (PATCH)
         * @returns {Promise<boolean>} whether the API took it
         */
        write: function (oModel, sMethod, sPath, oBody) {
            var sServiceUrl = oModel.getServiceUrl(),
                pToken = sToken === null ? fetchToken(sServiceUrl) : Promise.resolve(sToken);

            return pToken.then(function () {
                return send(sServiceUrl, sMethod, sPath, oBody);
            }).then(function (oResponse) {
                if (oResponse.ok) {
                    return true;
                }
                return messageOf(oResponse).then(function (sMessage) {
                    MessageBox.error(sMessage);
                    return false;
                });
            }).catch(function (oError) {
                MessageBox.error(oError.message || String(oError));
                return false;
            });
        }
    };
});
