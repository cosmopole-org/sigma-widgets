"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DOM_1 = require("./DOM");
const Runtime_1 = require("./Runtime");
const utils_1 = require("./utils");
class Creature {
    get key() { return this._key; }
    get cosmoId() { return this._cosmoId; }
    setCosmoId(cosmoId) { this._cosmoId = cosmoId; }
    get module() { return this._module; }
    get runtime() { return this._runtime; }
    get dom() { return this._dom; }
    getBaseMethod(methodId) {
        return this._runtime.stack[0].findUnit(methodId);
    }
    constructor(module, defaultValues) {
        this._key = (defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues._key) ? defaultValues._key : utils_1.default.generator.generateKey();
        this._cosmoId = defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.cosmoId;
        this._module = module;
        this._dom = (defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.dom) ? defaultValues.dom : new DOM_1.default(this._module, this);
        this._runtime = (defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.runtime) ? defaultValues.runtime : new Runtime_1.default(this._module, this);
        this.thisObj = defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.thisObj;
        if (!(defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.runtime)) {
            this._runtime.load();
        }
        if (!this.thisObj) {
            this.thisObj = {};
            Object.keys(this._runtime.stack[0].units).forEach(k => {
                if (!this._runtime.native[k] || (k === 'constructor')) {
                    this.thisObj[k] = this._runtime.stack[0].units[k];
                }
            });
            this.thisObj = {};
        }
        this.thisObj['setState'] = (stateUpdate) => {
            this.thisObj['state'] = Object.assign(Object.assign({}, this.thisObj['state']), stateUpdate);
            let newMetaBranch = utils_1.default.generator.nestedContext(this);
            let newRender = this.getBaseMethod('render')(newMetaBranch);
            this._module.applet.onCreatureStateChange(this, newRender);
        };
    }
}
exports.default = Creature;
//# sourceMappingURL=Creature.js.map