
import Applet from "./Applet"
import Creature from "./Creature"
import CreatureStore from "./CreatureStore"
import DOM from "./DOM"
import FuncStore from "./FuncStore"
import Runtime from "./Runtime"
import BaseElement from "./elements/BaseElement"
import Utils from './utils'

class Module {

    _applet
    get applet() { return this._applet }
    setApplet(applet) { this._applet = applet }

    _creatures
    get creatures() { return this._creatures }

    _key
    get key() { return this._key }

    _funcs
    get funcs() { return this._funcs }

    _dom
    get dom() { return this._dom }

    _ast
    get ast() { return this._ast }
    setAst(ast) { this._ast = ast }

    instantiate(props, styles, children, thisObj) {
        let creature = new Creature(
            this,
            {
                cosmoId: props?.key,
                thisObj: thisObj ?
                    {
                        ...thisObj,
                        props: props ? props : {},
                        styles: styles ? styles : {},
                        children: children ? children : []
                    } : {
                        props: props ? props : {},
                        styles: styles ? styles : {},
                        children: children ? children : []
                    }
            }
        )
        this._creatures.putCreature(creature)
        return creature
    }

    constructor(key, applet, ast) {
        this._key = key
        this._applet = applet
        this._ast = ast
        this._creatures = new CreatureStore()
        this._funcs = new FuncStore()
        this._dom = new DOM(this)
    }
}

export default Module
