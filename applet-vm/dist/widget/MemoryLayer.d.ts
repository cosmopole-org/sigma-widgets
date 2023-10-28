declare class MemoryLayer {
    private _units;
    get units(): {
        [id: string]: any;
    };
    findUnit(key: string): any;
    putUnit(key: string, unit: any): void;
    removeUnit(key: string): void;
    constructor(initialUnits?: {
        [id: string]: any;
    });
}
export default MemoryLayer;
