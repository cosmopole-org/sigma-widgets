
import DOM from "./DOM"
import Module from "./Module"
import Runtime from "./Runtime"
import BaseElement from "./elements/BaseElement"
import Utils from './utils'

class Creature {

    _key
    get key() { return this._key }

    _cosmoId
    get cosmoId() { return this._cosmoId }
    setCosmoId(cosmoId) { this._cosmoId = cosmoId }

    _module
    get module() { return this._module }

    _runtime
    get runtime() { return this._runtime }

    _dom
    get dom() { return this._dom }

    thisObj

    getBaseMethod(methodId) {
        return this._runtime.stack[0].findUnit(methodId)
    }

    constructor(module, defaultValues) {
        this._key = defaultValues?._key ? defaultValues._key : Utils.generator.generateKey()
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
        this.thisObj['setState'] = (stateUpdate) => {
            this.thisObj['state'] = { ...this.thisObj['state'], ...stateUpdate }
            let newMetaBranch = Utils.generator.nestedContext(this, { })
            let newRender = this.getBaseMethod('render')(newMetaBranch)
            this._module.applet.onCreatureStateChange(this, newRender)
        }
    }
}

export default Creature
