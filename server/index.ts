
import Module from './widget/Module'
import Native from './Native'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'

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
                this.setState({ counter: this.state.counter + 1 })
            }, 1000)
        }
        render() {
            return this.state.counter
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
