"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Module_1 = require("../Module");
let extractModules = (middleCode, applet) => {
    return middleCode.body
        .filter((declaration) => declaration.type === 'ClassDeclaration')
        .map((declaration) => {
        return new Module_1.default(declaration.id.name, applet, declaration);
    });
};
exports.default = { extractModules };
//# sourceMappingURL=compiler.js.map