
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
                items: [],
                counter: 0
            }
        }
        onMount() {
            setInterval(() => {
                this.state.counter++
                this.state.items.push(this.state.counter)
                this.setState(this.state)
            }, 1000)
        }
        render() {
            return (
                <box style={{ backgroundColor: '#eee', width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap' }}>
                    {
                        this.state.items.map(item => {
                            return (
                                <card key={item} style={{ margin: 8 }}>
                                    <tabs>
                                        <primary-tab>Video</primary-tab>
                                        <primary-tab>Photos</primary-tab>
                                        <primary-tab>Audio</primary-tab>
                                    </tabs>
                                </card>
                            )
                        })
                    }
                </box>
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
