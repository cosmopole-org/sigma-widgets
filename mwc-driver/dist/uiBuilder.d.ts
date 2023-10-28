declare class UiBuilder {
    bindings: {};
    constructor();
    createElement(controlType: string, tag: string, props: {
        [id: string]: any;
    }, styles: {
        [id: string]: any;
    }, control: any): HTMLElement;
    build(element: any, parentKey?: string): HTMLElement | undefined;
    createChild(newChild: any, parentKey: string): HTMLElement | undefined;
    deleteChild(childKey: string): void;
    replaceChild(element: any, newChild: any): HTMLElement | undefined;
    updateStyle(elementKey: string, cssKey: string, cssValue: any): void;
    updateProp(elementKey: string, propKey: string, propValue: any): void;
}
export default UiBuilder;
