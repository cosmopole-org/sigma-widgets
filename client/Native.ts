
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
}

export default Native
