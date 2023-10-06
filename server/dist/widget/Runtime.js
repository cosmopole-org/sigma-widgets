"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MemoryLayer_1 = require("./MemoryLayer");
const utils_1 = require("./utils");
class Runtime {
    get module() { return this._module; }
    get creature() { return this._creature; }
    get native() { return this._native; }
    pushOnStack(initialUnits) { this.stack.push(new MemoryLayer_1.default(initialUnits)); }
    popFromStack() { this.stack.pop(); }
    get stackTop() { return this.stack[this.stack.length - 1]; }
    resetStack() {
        this.stack = [];
        this.pushOnStack(Object.assign({}, this._native));
    }
    reset() {
        this.resetStack();
    }
    execute(ast) {
        utils_1.default.executor.executeBlock(ast, new utils_1.default.executor.ExecutionMeta({ creature: this._creature }));
    }
    load() {
        this.execute(this.module.ast.body.body);
    }
    clone() {
        let copy = new Runtime(this.module, this.creature, { native: this.native, stack: new Array(...this.stack) });
        return copy;
    }
    constructor(module, creature, reusableTools) {
        this.stack = [];
        this._module = module;
        this._creature = creature;
        this._native = (reusableTools === null || reusableTools === void 0 ? void 0 : reusableTools.native) ? reusableTools.native : this._module.applet._nativeBuilder(this._module);
        if (reusableTools === null || reusableTools === void 0 ? void 0 : reusableTools.stack) {
            this.stack = reusableTools.stack;
        }
        else {
            this.reset();
        }
    }
}
exports.default = Runtime;
//# sourceMappingURL=Runtime.js.map