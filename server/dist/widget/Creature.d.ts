import DOM from "./DOM";
import Module from "./Module";
import Runtime from "./Runtime";
declare class Creature {
    _key: string;
    get key(): string;
    private _cosmoId;
    get cosmoId(): string;
    setCosmoId(cosmoId: string): void;
    private _module;
    get module(): Module;
    _runtime: Runtime;
    get runtime(): Runtime;
    _dom: DOM;
    get dom(): DOM;
    thisObj: {
        [id: string]: any;
    };
    getBaseMethod(methodId: string): any;
    constructor(module: Module, defaultValues?: any);
}
export default Creature;
