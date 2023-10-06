import Creature from "./Creature"

class ExecutionMeta {

    creature
    declaration
    declarationType
    returnIdParent
    isAnotherCreature
    parentJsxKey

    constructor(metaDict) {
        this.creature = metaDict.creature
        this.declaration = (metaDict.declaration === true)
        this.declarationType = metaDict.declarationType
        this.returnIdParent = metaDict.returnIdParent
        this.isAnotherCreature = metaDict.isAnotherCreature
        this.parentJsxKey = metaDict.parentJsxKey
        if (this.declaration && !this.declarationType) {
            // TODO: throw invalid execution metadata exception
        }
    }
}

export default ExecutionMeta
