"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DOM {
    get module() { return this._module; }
    get creature() { return this._creature; }
    get root() { return this._root; }
    setRoot(root) { this._root = root; }
    constructor(module, creature, root) {
        this._module = module;
        this._creature = creature;
        this._root = root;
    }
}
exports.default = DOM;
//# sourceMappingURL=DOM.js.map