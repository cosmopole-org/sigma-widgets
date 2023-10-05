
import Module from './widget/Module'
import Native from './Native'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'
import BaseOrder from 'widget/orders/BaseOrder'

let applet = new Applet('frame')

applet.fill(
    `
    class Inner {
        constructor() { }
        onMount() { }
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
                name: 'kasper'
            }
        }
        onMount() {
            this.setState({name: 'keyhan'})
        }
        render() {
            return (
                <Inner text='5'>
                    {this.state.name}
                </Inner>
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
