import Applet from "./Applet";
import DOM from "./DOM";
import Runtime from "./Runtime";

class Module {

    _applet: Applet
    public setApplet(applet: Applet) { this._applet = applet }
    get key() { return this._applet.key }

    runtime: Runtime
    dom: DOM

    constructor(applet: Applet) {
        this._applet = applet
        this.runtime = new Runtime(this);
        this.dom = new DOM(this);
    }
}

export default Module
