import INative from "./widget/INative"

class Native extends INative {

    globalMemory = {}
    intervals = {}
    timeouts = {}
    controls = {}
    module = undefined

    nativeElement = (compType, props, styles, children) => {
        let control = this.controls[compType]
        let c = control.instantiate(props, styles, children)
        return c
    }
    Object = {
        keys: (obj) => {
            return Object.keys(obj)
        },
        values: (obj) => {
            return Object.values(obj)
        }
    }
    alert = (str) => {
        window.alert(str)
    }
    console = {
        log: (...strs) => {
            console.log(...strs)
        }
    }
    setInterval = (callback, period) => {
        this.intervals[setInterval(callback, period) + ''] = true
    }
    setTimeout = (callback, timeout) => {
        this.timeouts[setTimeout(callback, timeout) + ''] = true
    }

    constructor(module, controls) {
        super(module)
        this.module = module
        this.controls = controls
    }
}

export default Native