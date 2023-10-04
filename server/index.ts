
import Module from './widget/Module'
import Native from './Native'
import Applet from './widget/Applet'

let applet = new Applet('frame')

applet.fill(
    `
    class Test {
        constructor() {
            console.log('ok')
            this.name = 'keyhan'
        }
        render() {
            console.log('welcome', this.name, '!')
            return <text />
        }
    }
    class Button {
        constructor() {}
        render() {
            return (
                <Test key='1' />
            )
        }
    }
`
)

console.log(applet.run('Button', (mod: Module) => new Native(mod)))
