
import Module from './Module'
import Func from './Func'

class Applet {

    _key: string
    public get key() { return this._key }

    private _modules: { [id: string]: Module }
    public findModule(id: string) { return this._modules[id] }
    public putModule(module: Module) {
        module.setApplet(this)
        this._modules[module.key] = module
    }
    public removeModule(key: string) { delete this._modules[key] }

    private _genesis?: Func
    public get genesis() { return this._genesis }
    public setGenesis(genesis: Func) { this._genesis = genesis }

    public parse(jsxCode: string) {
        
    }

    constructor(genesis?: Func, modules?: { [id: string]: Module}) {
        this._key = Math.random().toString().substring(2)
        this._genesis = genesis
        this._modules = modules ? modules : {}
    }
}

export default Applet
