"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ExecutionMeta {
    constructor(metaDict) {
        this.creature = metaDict.creature;
        this.declaration = (metaDict.declaration === true);
        this.declarationType = metaDict.declarationType;
        this.returnIdParent = metaDict.returnIdParent;
        this.isAnotherCreature = metaDict.isAnotherCreature;
        this.parentJsxKey = metaDict.parentJsxKey;
        if (this.declaration && !this.declarationType) {
        }
    }
}
exports.default = ExecutionMeta;
//# sourceMappingURL=ExecutionMeta.js.map