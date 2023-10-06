import Applet from "./Applet";
import Creature from "./Creature";
import CreatureStore from "./CreatureStore";
import DOM from "./DOM";
import FuncStore from "./FuncStore";
import BaseElement from "./elements/BaseElement";
declare class Module {
    private _applet;
    get applet(): Applet;
    setApplet(applet: Applet): void;
    private _creatures;
    get creatures(): CreatureStore;
    private _key;
    get key(): string;
    private _funcs;
    get funcs(): FuncStore;
    private _dom;
    get dom(): DOM;
    private _ast?;
    get ast(): any;
    setAst(ast: any): void;
    instantiate(props?: {
        [id: string]: any;
    }, styles?: {
        [id: string]: any;
    }, children?: Array<BaseElement>, thisObj?: any): Creature;
    constructor(key: string, applet: Applet, ast?: any);
}
export default Module;
