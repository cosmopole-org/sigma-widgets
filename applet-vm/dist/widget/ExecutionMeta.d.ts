import Creature from "./Creature";
declare class ExecutionMeta {
    creature: Creature;
    declaration?: boolean;
    declarationType?: string;
    returnIdParent?: boolean;
    isAnotherCreature?: boolean;
    parentJsxKey: string;
    constructor(metaDict: any);
}
export default ExecutionMeta;
