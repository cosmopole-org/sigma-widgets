declare abstract class BaseProp {
    _type: string;
    get type(): string;
    abstract setValue(value: any): void;
    constructor(type: string);
}
export default BaseProp;
