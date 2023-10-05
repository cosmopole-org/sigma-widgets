
import Creature from "widget/Creature"
import INative from "./widget/INative"

class Native extends INative {

    private globalMemory = {}
    private intervals = {}
    private timeouts = {}

    public readonly console = {
        log: (...strs: Array<any>) => {
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
