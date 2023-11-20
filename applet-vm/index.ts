
import Module from './widget/Module'
import Applet, { Runnable } from './widget/Applet'
import Utils from './widget/utils'
import Controls from './widget/controls'
import INative from './widget/INative'
import Native from './native'

let applet = new Applet('frame')
applet.fill(`
class html {
    constructor() {

    }
    onMount() {

    }
    render() {
        return nativeElement('html', this.props, this.styles, this.children)
    }
}
class body {
    constructor() {

    }
    onMount() {

    }
    render() {
        return nativeElement('body', this.props, this.styles, this.children)
    }
}
class script {
    constructor() {

    }
    onMount() {

    }
    render() {
        return nativeElement('script', this.props, this.styles, this.children)
    }
}
`)
applet.fill(`
    <script>
        import hello from 'test'
        console.log(hello)
    </script>
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
