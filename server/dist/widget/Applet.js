"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runnable = void 0;
const utils_1 = require("./utils");
class Runnable {
    constructor(root, mount) {
        this.root = root;
        this.mount = mount;
    }
}
exports.Runnable = Runnable;
class Applet {
    get key() { return this._key; }
    findModule(id) { return this._modules[id]; }
    putModule(module) {
        module.setApplet(this);
        this._modules[module.key] = module;
    }
    removeModule(key) { delete this._modules[key]; }
    fill(middleCode) {
        this.middleCode = middleCode;
        let r = utils_1.default.compiler.extractModules(this.middleCode, this);
        r.forEach((module) => this.putModule(module));
    }
    onCreatureStateChange(creature, newVersion) {
        let oldVersion = this.oldVersions[creature._key];
        this.oldVersions[creature._key] = newVersion;
        this.update(utils_1.default.json.diff(oldVersion, newVersion));
    }
    run(genesis, nativeBuilder, update) {
        return new Promise(resolve => {
            this._nativeBuilder = nativeBuilder;
            this.update = update;
            this.cache.elements = {};
            this.cache.mounts = [];
            let genesisMod = this._modules[genesis];
            this._genesisCreature = genesisMod.instantiate();
            let genesisMetaContext = utils_1.default.generator.nestedContext(this._genesisCreature);
            this.cache.mounts.push(() => this._genesisCreature.getBaseMethod('onMount')(genesisMetaContext));
            this._genesisCreature.getBaseMethod('constructor')(genesisMetaContext);
            let view = this._genesisCreature.getBaseMethod('render')(genesisMetaContext);
            this.oldVersions[this._genesisCreature._key] = view;
            resolve(new Runnable(view, () => {
                this.cache.mounts.reverse().forEach((onMount) => onMount());
            }));
        });
    }
    constructor(key, modules) {
        this.cache = {
            elements: {},
            mounts: []
        };
        this.oldVersions = {};
        this._key = key;
        this._modules = modules ? modules : {};
    }
}
exports.default = Applet;
//# sourceMappingURL=Applet.js.map