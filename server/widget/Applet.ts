
import Module from './Module'
import Utils from './utils'
import INative from './INative'
import Creature from './Creature'
import BaseElement from './elements/BaseElement'
import BaseOrder from './orders/BaseOrder'

export class Runnable {

    root: BaseElement
    mount: () => void

    constructor(root: BaseElement, mount: () => void) {
        this.root = root
        this.mount = mount
    }
}

class Applet {

    _key: string
    public get key() { return this._key }

    _genesisCreature: Creature

    _nativeBuilder: (mod: Module) => INative

    private _modules: { [id: string]: Module }
    public findModule(id: string) { return this._modules[id] }
    public putModule(module: Module) {
        module.setApplet(this)
        this._modules[module.key] = module
    }
    public removeModule(key: string) { delete this._modules[key] }

    middleCode: acorn.Node

    public fill(jsxCode: string) {
        this.middleCode = Utils.compiler.parse(jsxCode)
        let r = Utils.compiler.extractModules(this.middleCode, this);
        r.forEach((module: Module) => this.putModule(module))
    }

    cache = {
        elements: {},
        mounts: []
    }

    update: (u: BaseOrder) => void

    public run(genesis: string, nativeBuilder: (mod: Module) => INative, update: (u: BaseOrder) => void) {
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
            resolve(
                new Runnable(
                    view,
                    () => {
                        this.cache.mounts.reverse().forEach((onMount: any) => onMount())
                    }
                )
            )
        })
    }

    constructor(key: string, modules?: { [id: string]: Module }) {
        this._key = key
        this._modules = modules ? modules : {}
    }
}

export default Applet
