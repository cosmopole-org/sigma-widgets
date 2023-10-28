import BaseProp from './BaseProp';
declare class NumberProp extends BaseProp {
    _value?: number;
    get value(): number;
    setValue(v: any): void;
    getValue(): number;
    _defaultValue: number;
    get defaultValue(): number;
    constructor(defaultValue: number);
}
export default NumberProp;