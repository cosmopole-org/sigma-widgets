
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
                <box style={{ backgroundColor: '#eee', width: '100%', height: '100%' }}>
                    <tabs style={{ width: '100%', height: 56 }}>
                        <primary-tab>Video</primary-tab>
                        <primary-tab>Photos</primary-tab>
                        <primary-tab>Audio</primary-tab>
                    </tabs>
                    <box style={{ width: '100%', height: 'calc(100% - 56px)', display: 'flex', flexWrap: 'wrap', overflowY: 'auto', alignContent: 'flex-start' }}>
                        {
                            this.state.items.map(item => {
                                return (
                                    <card key={item} style={{ margin: 8, width: 100, height: 100 }}>
                                        <text text={item} style={{width: '100%', height: '100%', display: 'flex', verticalAlign: 'middle', textAlign: 'center', alignItems: 'center', justifyContent: 'center' }} />
                                        <box style={{width: '100%', height: 32, alignItems: 'center', justifyContent: 'center', textAlign: 'center', display: 'flex' }}>
                                            <button style={{width: 32, height: 32}} caption='-' onClick={() => console.log('test................')} />
                                            <button style={{width: 32, height: 32}} caption='+' />
                                        </box>
                                    </card>
                                )
                            })
                        }
                    </box>
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
