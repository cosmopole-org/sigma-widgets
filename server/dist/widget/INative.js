"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class INative {
    get key() { return this._module.key; }
    constructor(module) {
        this._module = module;
    }
}
exports.default = INative;
//# sourceMappingURL=INative.js.map