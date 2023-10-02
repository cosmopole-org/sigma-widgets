
import Module from './Module'
import Func from './Func'
import Utils from './utils'
import INative from './INative'

class Applet {

    _key: string
    public get key() { return this._key }

    _nativeBuilder: (mod: Module) => INative

    private _modules: { [id: string]: Module }
    public findModule(id: string) { return this._modules[id] }
    public putModule(module: Module) {
        module.setApplet(this)
        this._modules[module.key] = module
    }
    public removeModule(key: string) { delete this._modules[key] }

    public instantiate(jsxCode: string) {
        let middleCode = Utils.compiler.parse(jsxCode)
        // console.log(Utils.json.prettify(middleCode))
        let r = Utils.compiler.extractModules(middleCode, this);
        r.forEach((module: Module) => this.putModule(module))
    }

    run(genesis: string, nativeBuilder: (mod: Module) => INative) {
        this._nativeBuilder = nativeBuilder
        Object.keys(this._modules).forEach((moduleKey: string) => {
            this._modules[moduleKey].instantiate()
        })
        let genesisMod = this._modules[genesis]
        genesisMod.runtime.stackTop.findUnit('constructor')()
    }

    constructor(key: string, modules?: { [id: string]: Module }) {
        this._key = key
        this._modules = modules ? modules : {}
    }
}

export default Applet
