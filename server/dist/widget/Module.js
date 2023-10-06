"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Creature_1 = require("./Creature");
const CreatureStore_1 = require("./CreatureStore");
const DOM_1 = require("./DOM");
const FuncStore_1 = require("./FuncStore");
class Module {
    get applet() { return this._applet; }
    setApplet(applet) { this._applet = applet; }
    get creatures() { return this._creatures; }
    get key() { return this._key; }
    get funcs() { return this._funcs; }
    get dom() { return this._dom; }
    get ast() { return this._ast; }
    setAst(ast) { this._ast = ast; }
    instantiate(props, styles, children, thisObj) {
        let creature = new Creature_1.default(this, {
            cosmoId: props === null || props === void 0 ? void 0 : props.key,
            thisObj: thisObj ? Object.assign(Object.assign({}, thisObj), { props: props ? props : {}, styles: styles ? styles : {}, children: children ? children : [] }) : {
                props: props ? props : {},
                styles: styles ? styles : {},
                children: children ? children : []
            }
        });
        this._creatures.putCreature(creature);
        return creature;
    }
    constructor(key, applet, ast) {
        this._key = key;
        this._applet = applet;
        this._ast = ast;
        this._creatures = new CreatureStore_1.default();
        this._funcs = new FuncStore_1.default();
        this._dom = new DOM_1.default(this);
    }
}
exports.default = Module;
//# sourceMappingURL=Module.js.map