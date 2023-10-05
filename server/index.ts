
import Module from './widget/Module'
import Native from './Native'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'
import BaseOrder from 'widget/orders/BaseOrder'

let applet = new Applet('frame')

applet.fill(
    `
    class Test {
        constructor() { }
        onMount() {
            console.log('Test mounted....')
        }
        render() {
            return (
                <text text='5'>
                    {this.children}
                </text>
            )
        }
    }
    class Button {
        constructor() {
            this.state = {
                name: 'keyhan'
            }
        }
        onMount() {
            console.log('main mounted....')
            this.setState({ name: 'keyhan' })
        }
        render() {
            return (
                <Test>
                    {this.state.name}
                </Test>
            )
        }
    }
`
)

const update = (u: BaseOrder) => {
    console.log(u)
}

applet.run('Button', (mod: Module) => new Native(mod), update).then((runnable: Runnable) => {
    console.log(Utils.json.prettify(runnable.root))
    runnable.mount()
})
