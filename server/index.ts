
import Module from './widget/Module'
import Native from './Native'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'
import BaseOrder from 'widget/orders/BaseOrder'

let applet = new Applet('frame')

applet.fill(
    `
    class Test {
        constructor() {
            
        }
        onMount() {
            
        }
        render() {
            return (
                <text>
                    {this.children}
                </text>
            )
        }
    }
    class Button {
        constructor() {
            this.state = {
                items: [],
                count: 0
            }
        }
        onMount() {
            setInterval(() => {
                this.state.count++
                this.state.items.push(this.state.count)
                this.setState({...this.state, counterName: this.state.count})
            }, 1000)
        }
        render() {
            return (
                <text>
                    {
                        this.state.items.map(item => {
                            return (
                                <text key={'text-' + item}>
                                    {item}
                                </text>
                            )
                        })
                    }
                </text>
            )
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
