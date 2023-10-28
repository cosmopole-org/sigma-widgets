import Creature from './Creature';
import INative from './INative';
import MemoryLayer from './MemoryLayer';
import Memory from './MemoryLayer';
import Module from './Module';
declare class Runtime {
    private _module;
    get module(): Module;
    private _creature;
    get creature(): Creature;
    private _native;
    get native(): INative;
    stack: Array<Memory>;
    pushOnStack(initialUnits?: {
        [id: string]: any;
    }): void;
    popFromStack(): void;
    get stackTop(): MemoryLayer;
    resetStack(): void;
    reset(): void;
    execute(ast: any): void;
    load(): void;
    clone(): Runtime;
    constructor(module: Module, creature?: Creature, reusableTools?: any);
}
export default Runtime;
