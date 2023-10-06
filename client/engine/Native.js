
import INative from "./widget/INative"

class Native extends INative {

    globalMemory = {}
    intervals = {}
    timeouts = {}

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
}

export default Native
