"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CreatureStore {
    putCreature(creature) { this._store[creature.key] = creature; }
    removeCreature(key) { delete this._store[key]; }
    findCreature(key) { return this._store[key]; }
    constructor() {
        this._store = {};
    }
}
exports.default = CreatureStore;
//# sourceMappingURL=CreatureStore.js.map