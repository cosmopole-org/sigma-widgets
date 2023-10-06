"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
class Func {
    get key() { return this._key; }
    get code() { return this._code; }
    setCode(code) { this._code = code; }
    get ast() { return this._ast; }
    setAst(ast) { this._ast = ast; }
    constructor(code, ast) {
        this._key = utils_1.default.generator.generateKey();
        this._code = code;
        this._ast = ast;
    }
}
exports.default = Func;
//# sourceMappingURL=Func.js.map