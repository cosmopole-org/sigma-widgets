
import INative from "./widget/INative"

class Native extends INative {

    globalMemory = {}
    intervals = {}
    timeouts = {}

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
}

export default Native
