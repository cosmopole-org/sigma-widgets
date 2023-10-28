declare const _default: {
    generator: {
        generateKey: () => string;
        prepareElement: (typeName: string, defaultProps: {
            [id: string]: import("../props/BaseProp").default;
        }, overridenProps: {
            [id: string]: any;
        }, defaultStyles: {
            [id: string]: any;
        }, overridenStyles: {
            [id: string]: any;
        }, children: import("../elements/BaseElement").default[]) => import("../elements/BaseElement").default;
        nestedContext: (creature: import("../Creature").default, otherMetas?: import("../ExecutionMeta").default) => import("../ExecutionMeta").default;
    };
    compiler: {
        parse: (jsxCode: string) => import("acorn").Node;
        extractModules: (middleCode: any, applet: import("../Applet").default) => any;
        styleToCssString: (rules: any) => string;
        buildRule: (key: any, value: any) => string;
        buildValue: (key: any, value: any) => string;
    };
    json: {
        prettify: (obj: any) => string;
        diff: (el1: import("../elements/BaseElement").default, el2: import("../elements/BaseElement").default) => any[];
    };
    executor: {
        executeSingle: (code: any, meta: import("../ExecutionMeta").default) => any;
        executeBlock: (codes: any[], meta: import("../ExecutionMeta").default) => any;
        ExecutionMeta: typeof import("../ExecutionMeta").default;
    };
};
export default _default;
