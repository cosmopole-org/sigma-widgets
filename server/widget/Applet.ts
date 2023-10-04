
import Module from './Module'
import Utils from './utils'
import INative from './INative'
import Creature from './Creature'
import ExecutionMeta from './ExecutionMeta'

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

    run(genesis: string, nativeBuilder: (mod: Module) => INative) {
        this._nativeBuilder = nativeBuilder
        let genesisMod = this._modules[genesis]
        this._genesisCreature = genesisMod.instantiate()
        let genesisMetaContext = Utils.generator.nestedContext(this._genesisCreature)
        this._genesisCreature.runtime.stack[0].findUnit('constructor')(genesisMetaContext)
        let view = this._genesisCreature.runtime.stack[0].findUnit('render')(genesisMetaContext)
        return view
    }

    constructor(key: string, modules?: { [id: string]: Module }) {
        this._key = key
        this._modules = modules ? modules : {}
    }
}

export default Applet
