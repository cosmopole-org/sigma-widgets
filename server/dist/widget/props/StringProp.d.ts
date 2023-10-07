import BaseProp from './BaseProp';
declare class StringProp extends BaseProp {
    _value?: string;
    get value(): string;
    setValue(v: any): void;
    _defaultValue: string;
    get defaultValue(): string;
    constructor(defaultValue: string);
}
export default StringProp;