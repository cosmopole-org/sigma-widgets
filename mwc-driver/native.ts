
class Native {

    globalMemory = {}
    intervals = {}
    timeouts = {}
    controls = {}
    module = undefined

    nativeElement = (compType: string, props: {[id: string]: any}, styles: {[id: string]: any}, children: Array<any>) => {
        let control = this.controls[compType]
        let c = control.instantiate(props, styles, children)
        return c
    }
    Object = {
        keys: (obj: any) => {
            return Object.keys(obj)
        },
        values: (obj: any) => {
            return Object.values(obj)
        }
    }
    alert = (str: any) => {
        window.alert(str)
    }
    console = {
        log: (...strs: Array<any>) => {
            console.log(...strs)
        }
    }
    setInterval = (callback: () => void, period: number) => {
        this.intervals[setInterval(callback, period) + ''] = true
    }
    setTimeout = (callback: () => void, timeout: number) => {
        this.timeouts[setTimeout(callback, timeout) + ''] = true
    }

    constructor(module: any, controls: {[id: string]: any}) {
        this.module = module
        this.controls = controls
    }
}

export default Native
