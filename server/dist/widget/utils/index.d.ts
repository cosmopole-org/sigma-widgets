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
        extractModules: (middleCode: any, applet: import("../Applet").default) => any;
    };
    json: {
        prettify: (obj: any) => string;
        diff: (obj1: any, obj2: any) => {};
    };
    executor: {
        executeSingle: (code: any, meta: import("../ExecutionMeta").default) => any;
        executeBlock: (codes: any[], meta: import("../ExecutionMeta").default) => any;
        ExecutionMeta: typeof import("../ExecutionMeta").default;
    };
};
export default _default;
