import BaseProp from './BaseProp';
declare class FuncProp extends BaseProp {
    _value?: () => void;
    get value(): () => void;
    setValue(v: any): void;
    getValue(): () => void;
    _defaultValue?: () => void;
    get defaultValue(): () => void;
    constructor(defaultValue?: () => void);
}
export default FuncProp;
