
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
            setTimeout(() => {
                this.setState({ counter: this.state.counter + 5 })
            }, 1000)
        }
        render() {
            return <text text={this.state.counter} />
        }
    }
    class Test {
        constructor() {
            this.state = {
                counter: 0
            }
        }
        onMount() {

        }
        render() {
            let { counter, test } = this.state
            console.log(counter, test)
        }
    }
    `
)

const update = (key: string, u: any) => {
    console.log(Utils.json.prettify(u))
}

applet.run('Test', (mod: Module) => new Native(mod), update).then((runnable: Runnable) => {
    console.log(Utils.json.prettify(runnable.root))
    runnable.mount()
})
