
import Module from './widget/Module'
import Native from './Native'
import Applet from './widget/Applet'

let applet = new Applet('frame')

applet.instantiate(
    `
    class Test {
        constructor() {
            console.log('creating test...')
        }
        render() {
            return <text text='hello world' />
        }
    }
    class Button {
        constructor() {
            let a = 1
            setInterval(() => {
                function test() {
                    console.log(a)
                }
                a++
                test()
            }, 1000)
        }
        render() {
            return <Test />
        }
    }
`
)

let view = applet.run('Button', (mod: Module) => new Native(mod))
console.log(view)
