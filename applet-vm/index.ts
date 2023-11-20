
import Module from './widget/Module'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'
import Controls from './widget/controls'
import INative from './widget/INative'
import Native from './native'

let applet = new Applet('frame')
applet.fill(`
    class Person {
        constructor(name, age) {
            this.name = name
            this.age = age
        }
        getInfo() {
            return '[ ' + this.name + ' , ' + this.age + ' ]'
        }
    }
    class Group {
        constructor() {
            this.person = new Person('keyhan', 25)

        }
        print() {
            console.log(this.person.getInfo())
        }
    }
    let group = new Group()
    group.print()
`)
applet.setContextBuilder((mod: Module) => new Native(mod, Controls))
applet.runRaw((key: string, u: any) => { }).then((runnable: Runnable) => {
    console.log(Utils.json.prettify(runnable.root))
    runnable.mount()
})

export {
    Applet,
    Runnable,
    Module,
    Utils,
    Controls,
    INative
}
