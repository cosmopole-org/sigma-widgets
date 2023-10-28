import Creature from './Creature';
import Module from './Module';
import BaseElement from './elements/BaseElement';
declare class DOM {
    private _module;
    get module(): Module;
    private _creature;
    get creature(): Creature;
    private _root?;
    get root(): BaseElement;
    setRoot(root: BaseElement): void;
    constructor(module: Module, creature?: Creature, root?: BaseElement);
}
export default DOM;
