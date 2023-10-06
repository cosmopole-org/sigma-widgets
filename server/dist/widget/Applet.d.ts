import Module from './Module';
import INative from './INative';
import Creature from './Creature';
import BaseElement from './elements/BaseElement';
import BaseOrder from './orders/BaseOrder';
export declare class Runnable {
    root: BaseElement;
    mount: () => void;
    constructor(root: BaseElement, mount: () => void);
}
declare class Applet {
    _key: string;
    get key(): string;
    _genesisCreature: Creature;
    _nativeBuilder: (mod: Module) => INative;
    private _modules;
    findModule(id: string): Module;
    putModule(module: Module): void;
    removeModule(key: string): void;
    middleCode: any;
    fill(middleCode: any): void;
    cache: {
        elements: {};
        mounts: any[];
    };
    oldVersions: {};
    onCreatureStateChange(creature: Creature, newVersion: BaseElement): void;
    update: (u: any) => void;
    run(genesis: string, nativeBuilder: (mod: Module) => INative, update: (u: BaseOrder) => void): Promise<unknown>;
    constructor(key: string, modules?: {
        [id: string]: Module;
    });
}
export default Applet;
