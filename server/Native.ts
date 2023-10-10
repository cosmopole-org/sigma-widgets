
import Creature from "widget/Creature"
import INative from "./widget/INative"

class Native extends INative {

    private globalMemory = {}
    private intervals = {}
    private timeouts = {}

    public readonly Object = {
        keys: (obj: any) => {
            return Object.keys(obj)
        },
        values: (obj: any) => {
            return Object.values(obj)
        }
    }
    alert = (str: any) => {
        // window.alert(str)
    }
    public readonly console = {
        log: (...strs: any) => {
            console.log(...strs)
        }
    }
    public readonly setInterval = (callback: any, period: number) => {
        this.intervals[setInterval(callback, period) + ''] = true 
    }
    public readonly setTimeout = (callback: any, timeout: number) => {
        this.timeouts[setTimeout(callback, timeout) + ''] = true
    }
}

export default Native
