
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
            this.state = {
                counter: 0
            }
        }
        onMount() {
            setInterval(() => {
                this.state.counter++
                this.setState(this.state)
            }, 1000)
        }
        render() {
            return this.state.counter % 2 === 0 ? this.state.counter : null
        }
    }
`
)

const update = (u: any) => {
    console.log(Utils.json.prettify(u))
}

applet.run('Button', (mod: Module) => new Native(mod), update).then((runnable: Runnable) => {
    console.log(Utils.json.prettify(runnable.root))
    runnable.mount()
})
