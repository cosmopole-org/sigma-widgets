import BaseProp from './BaseProp';
declare class BooleanProp extends BaseProp {
    _value?: boolean;
    get value(): boolean;
    setValue(v: any): void;
    getValue(): boolean;
    _defaultValue: boolean;
    get defaultValue(): boolean;
    constructor(defaultValue: boolean);
}
export default BooleanProp;
