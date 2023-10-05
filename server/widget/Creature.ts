
import DOM from "./DOM"
import Module from "./Module"
import Runtime from "./Runtime"
import Create from "./orders/Create"
import Utils from './utils'

class Creature {

    private _key: string
    public get key() { return this._key }

    private _cosmoId: string
    public get cosmoId() { return this._cosmoId }
    public setCosmoId(cosmoId: string) { this._cosmoId = cosmoId }

    private _module: Module
    public get module() { return this._module }

    public _runtime: Runtime
    public get runtime() { return this._runtime }

    public _dom: DOM
    public get dom() { return this._dom }

    public thisObj: { [id: string]: any }

    public getBaseMethod(methodId: string) {
        return this._runtime.stack[0].findUnit(methodId)
    }

    constructor(module: Module, defaultValues?: any) {
        this._key = defaultValues?.key ? defaultValues.key : Utils.generator.generateKey()
        this._cosmoId = defaultValues?.cosmoId
        this._module = module
        this._dom = defaultValues?.dom ? defaultValues.dom : new DOM(this._module, this)
        this._runtime = defaultValues?.runtime ? defaultValues.runtime : new Runtime(this._module, this)
        this.thisObj = defaultValues?.thisObj
        if (!defaultValues?.runtime) {
            this._runtime.load()
        }
        if (!this.thisObj) {
            this.thisObj = {}
            Object.keys(this._runtime.stack[0].units).forEach(k => {
                if (!this._runtime.native[k] || (k === 'constructor')) {
                    this.thisObj[k] = this._runtime.stack[0].units[k]
                }
            })
            this.thisObj = {}
        }
        this.thisObj['setState'] = (stateUpdate: { [id: string]: any }) => {
            this.thisObj['state'] = { ...this.thisObj['state'], ...stateUpdate }
            let newMetaBranch = Utils.generator.nestedContext(this)
            let newRender = this.getBaseMethod('render')(newMetaBranch)
            module.applet.update(new Create(newRender))
        }
    }
}

export default Creature
