
import UiBuilder from './uiBuilder'
import Native from './native'

class MwcDriver {

    applet;
    root;
    uiBuilder;

    update(key: string, updates: Array<any>) {
        console.log(updates)
        let that = this
        console.log(this)
        updates.forEach((u: any) => {
            if (u.__action__ === 'element_deleted') {
                that.uiBuilder.deleteChild(u.__key__)
            } else if (u.__action__ === 'element_created') {
                that.uiBuilder.createChild(u.__element__, u.__parentKey__)
            } else if (u.__action__ === 'props_updated') {
                Object.keys(u.__updated__).forEach(propKey => {
                    that.uiBuilder.updateProp(u.__key__, propKey, u.__updated__[propKey]._value)
                })
            } else if (u.__action__ === 'styles_updated') {
                Object.keys(u.__updated__).forEach(styleKey => {
                    that.uiBuilder.updateStyle(u.__key__, styleKey, u.__updated__[styleKey])
                })
            }
        });
    }

    start(genesisComponent: string, Controls: { [id: string]: any }, scope: (mod: any) => any) {
        this.applet.run(genesisComponent, scope, this.update).then((runnable: any) => {
            let ui = this.uiBuilder.build(runnable.root)
            ui && (this.root.appendChild(ui))
            runnable.mount()
        })
    }

    constructor(applet: any, container: HTMLElement) {
        this.root = container
        this.applet = applet
        this.uiBuilder = new UiBuilder()
        this.update = this.update.bind(this)
        this.start = this.start.bind(this)
    }
}

export default MwcDriver
