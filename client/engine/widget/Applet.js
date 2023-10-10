
import Module from './Module'
import Utils from './utils'
import INative from './INative'
import Creature from './Creature'
import BaseElement from './elements/BaseElement'

export class Runnable {

    root
    mount

    constructor(root, mount) {
        this.root = root
        this.mount = mount
    }
}

class Applet {

    _key
    get key() { return this._key }

    _genesisCreature

    _nativeBuilder

    _modules
    findModule(id) { return this._modules[id] }
    putModule(module) {
        module.setApplet(this)
        this._modules[module.key] = module
    }
    removeModule(key) { delete this._modules[key] }

    middleCode

    fill(middleCode) {
        this.middleCode = middleCode
        let r = Utils.compiler.extractModules(this.middleCode, this);
        r.forEach((module) => this.putModule(module))
    }

    cache = {
        elements: {},
        mounts: []
    }

    oldVersions = {}

    onCreatureStateChange(creature, newVersion) {
        let oldVersion = this.oldVersions[creature._key]
        this.oldVersions[creature._key] = newVersion
        // newVersion._key = oldVersion._key
        this.cache.elements[newVersion._key] = newVersion._key
        delete this.cache.elements[oldVersion._key]
        this.update(oldVersion._key, newVersion._key, Utils.json.diff(oldVersion, newVersion))
    }

    update

    run(genesis, nativeBuilder, update) {
        return new Promise(resolve => {
            this._nativeBuilder = nativeBuilder
            this.update = update
            this.cache.elements = {}
            this.cache.mounts = []
            let genesisMod = this._modules[genesis]
            this._genesisCreature = genesisMod.instantiate()
            let genesisMetaContext = Utils.generator.nestedContext(this._genesisCreature)
            this.cache.mounts.push(() => this._genesisCreature.getBaseMethod('onMount')(genesisMetaContext))
            this._genesisCreature.getBaseMethod('constructor')(genesisMetaContext)
            let view = this._genesisCreature.getBaseMethod('render')(genesisMetaContext)
            this.oldVersions[this._genesisCreature._key] = view
            resolve(
                new Runnable(
                    view,
                    () => {
                        this.cache.mounts.reverse().forEach((onMount) => onMount())
                    }
                )
            )
        })
    }

    constructor(key, modules) {
        this._key = key
        this._modules = modules ? modules : {}
    }
}

export default Applet
