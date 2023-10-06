import BaseProp from "../props/BaseProp";
declare class BaseElement {
    _key: string;
    get key(): string;
    private _controlType;
    get controlType(): string;
    _props: {
        [key: string]: BaseProp;
    };
    get props(): {
        [key: string]: BaseProp;
    };
    _styles: {
        [key: string]: any;
    };
    get styles(): {
        [key: string]: any;
    };
    _children: Array<BaseElement>;
    get children(): BaseElement[];
    constructor(key: string, controlType: string, props: {
        [key: string]: BaseProp;
    }, styles: {
        [key: string]: any;
    }, children?: Array<BaseElement>);
}
export default BaseElement;
