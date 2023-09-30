
import Module from './widget/Module'
import Native from './Native'
import Applet from './widget/Applet'

let applet = new Applet('frame')

applet.instantiate(
    `
    class Button {
        constructor() {
            console.log('hello world !')
        }
    }

    class Box {

    }
`
)

applet.run('Button', (mod: Module) => new Native(mod))
