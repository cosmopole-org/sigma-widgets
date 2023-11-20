
import Module from './Module'
import Utils from './utils/index'
import INative from './INative'
import Creature from './Creature'
import BaseElement from './elements/BaseElement'

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

    middleCode: any

    public fill(jsxCode: any) {
        this.middleCode = Utils.compiler.parse(jsxCode)
        console.log(Utils.json.prettify(this.middleCode))
        let r = Utils.compiler.extractModules(this.middleCode, this)
        r.forEach((module: Module) => this.putModule(module))
    }

    cache = {
        elements: {},
        mounts: []
    }

    oldVersions = {}

    onCreatureStateChange(creature: Creature, newVersion: BaseElement) {
        let oldVersion = this.oldVersions[creature._key]
        this.oldVersions[creature._key] = newVersion
        let updates = Utils.json.diff(oldVersion, newVersion)
        updates.forEach((u: any) => {
            if (u.__action__ === 'element_deleted') {
                let keys = Object.keys(this.cache.elements).filter(k => {
                    if (k.startsWith(u.__key__)) {
                        delete this.cache.elements[k]
                        return true
                    } else {
                        return false
                    }
                })
                if (keys.length > 0) {
                    let temp = keys[keys.length - 1].split('-')
                    if (temp.length > 1) {
                        let temp2 = temp.slice(0, temp.length - 1).join('-')
                        delete this.cache.elements[temp2]
                    }
                }
            }
        })
        this.update(oldVersion._key, updates)
    }

    update: (key: string, u: any) => void
    firstMount: boolean = false;

    public runRaw(update: (key: string, u: any) => void) {
        return new Promise(resolve => {
            this.update = update
            this.firstMount = false
            this.cache.elements = {}
            this.cache.mounts = []
            let dummyClassMiddleCode = Utils.compiler.parse('class Main {}')
            let r = Utils.compiler.extractModules(dummyClassMiddleCode, this)
            let genesisMod = r[0]
            this.putModule(genesisMod)
            this._genesisCreature = genesisMod.instantiate()
            let genesisMetaContext = Utils.generator.nestedContext(this._genesisCreature)
            let view = Utils.executor.executeBlock(this.middleCode.body, genesisMetaContext)
            resolve(
                new Runnable(
                    view,
                    () => {
                        this.firstMount = true
                        this.cache.mounts.reverse().forEach((onMount: any) => onMount())
                    }
                )
            )
        })
    }

    public setContextBuilder(ctxBuilder: (mod: Module) => INative) {
        this._nativeBuilder = ctxBuilder
    }

    public run(genesis: string, update: (key: string, u: any) => void) {
        return new Promise(resolve => {
            this.update = update
            this.firstMount = false
            this.cache.elements = {}
            this.cache.mounts = []
            let genesisMod = this._modules[genesis]
            this._genesisCreature = genesisMod.instantiate()
            let genesisMetaContext = Utils.generator.nestedContext(this._genesisCreature)
            this._genesisCreature._runtime.stack[0].putUnit('this', this._genesisCreature?.thisObj)
            this.cache.mounts.push(() => this._genesisCreature.getBaseMethod('onMount')(genesisMetaContext))
            this._genesisCreature.getBaseMethod('constructor')(genesisMetaContext)
            let view = this._genesisCreature.getBaseMethod('render')(genesisMetaContext)
            this.oldVersions[this._genesisCreature._key] = view
            resolve(
                new Runnable(
                    view,
                    () => {
                        this.firstMount = true
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
