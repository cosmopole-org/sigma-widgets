
import Module from './widget/Module'
import Native from './Native'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'

let applet = new Applet('frame')

applet.fill(
    `
    class Button {
        constructor() {
            let { data } = this.props
            this.state = {
                counter: data
            }
        }
        onMount() {
            let { counter } = this.state
            setTimeout(() => {
                this.setState({ counter: counter + ' another test !' })
            }, 1000)
        }
        render() {
            return <text text={'hello ' + this.state.counter} />
        }
    }
    class Test {
        constructor() {
            this.state = {
                items: [ 1 ],
                counter: 0
            }
        }
        onMount() {
            let { counter } = this.state
            setTimeout(() => {
                this.setState({ counter: counter + 1, items: [ 1, 2 ] })
            }, 2000)
            setTimeout(() => {
                this.setState({ items: [ 1, 2, 3 ] })
            }, 5000)
            setTimeout(() => {
                this.setState({ items: [ 1, 2, 3, 4 ] })
            }, 6000)
        }
        render() {
            let { counter, items } = this.state
            return counter === 0 ? (
                <box>
                    {
                        items.map(item => {
                            return <Button key={item} data={'test 1 ' + item} />
                        })
                    }
                </box>
            ) : (
                <box>
                    {
                        items.map(item => {
                            return <Button key={item} data={'test 2 ' + item} />
                        })
                    }
                </box>
            )
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
