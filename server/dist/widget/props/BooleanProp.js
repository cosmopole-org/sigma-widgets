"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseProp_1 = require("./BaseProp");
class BooleanProp extends BaseProp_1.default {
    get value() { return this._value; }
    setValue(v) { this._value = v; }
    get defaultValue() { return this._defaultValue; }
    constructor(defaultValue) {
        super('boolean');
        this._value = defaultValue;
        this._defaultValue = defaultValue;
    }
}
exports.default = BooleanProp;
//# sourceMappingURL=BooleanProp.js.map