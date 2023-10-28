import Func from "./Func";
declare class FuncStore {
    private _store;
    get store(): {
        [id: string]: Func;
    };
    putFunc(func: Func): void;
    removeFunc(key: string): void;
    findFunc(key: string): Func;
    constructor();
}
export default FuncStore;
