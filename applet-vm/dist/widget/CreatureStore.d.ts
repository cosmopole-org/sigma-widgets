import Creature from "./Creature";
declare class CreatureStore {
    private _store;
    putCreature(creature: Creature): void;
    removeCreature(key: string): void;
    findCreature(key: string): Creature;
    constructor();
}
export default CreatureStore;
