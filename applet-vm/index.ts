
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
    let person = new Person('keyhan', 25)
    console.log(person.getInfo())
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
