
import Module from './widget/Module'
import Native from './Native'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'
import BaseOrder from 'widget/orders/BaseOrder'

let applet = new Applet('frame')

applet.fill(
    `
    class Button {
        constructor() {

        }
        onMount() {
            
        }
        render() {
            return null
        }
    }
`
)

const update = (u: BaseOrder) => {
    console.log(Utils.json.prettify(u))
}

applet.run('Button', (mod: Module) => new Native(mod), update).then((runnable: Runnable) => {
    console.log(Utils.json.prettify(runnable.root))
    runnable.mount()
})
