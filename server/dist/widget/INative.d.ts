import Module from "./Module";
declare class INative {
    _module: Module;
    get key(): string;
    constructor(module: Module);
}
export default INative;
