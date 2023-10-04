import Creature from "./Creature"

class ExecutionMeta {

    creature: Creature
    declaration?: boolean
    declarationType?: string
    returnIdParent?: boolean
    isAnotherCreature?: boolean

    constructor(metaDict: any) {
        this.creature = metaDict.creature
        this.declaration = (metaDict.declaration === true)
        this.declarationType = metaDict.declarationType
        this.returnIdParent = metaDict.returnIdParent
        this.isAnotherCreature = metaDict.isAnotherCreature
        if (this.declaration && !this.declarationType) {
            // TODO: throw invalid execution metadata exception
        }
    }
}

export default ExecutionMeta
