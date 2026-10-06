"use strict";

// For the mock's hooks (webapp/localService/project/data): a list that comes
// inside its parent's body, as the API takes it (a deep insert, or a deep
// update that replaces the whole list), kept in a set of its own there.

/**
 * Replaces the children of one parent with the rows given.
 * @param {object} base the hook's this.base
 * @param {string} set the children's entity set
 * @param {string} parentKey the children's property that names the parent
 * @param {string} parentID the parent
 * @param {object[]} rows the new children, without parentKey
 * @param {function(object): object} keysOf a child's key values
 */
async function replaceChildren(base, set, parentKey, parentID, rows, keysOf) {
    const children = await base.getEntityInterface(set);

    for (const child of (await children.fetchEntries({})).filter((c) => c[parentKey] === parentID)) {
        await children.removeEntry(keysOf(child));
    }
    for (const row of rows) {
        await children.addEntry(Object.assign({}, row, { [parentKey]: parentID }));
    }
}

module.exports = { replaceChildren };
