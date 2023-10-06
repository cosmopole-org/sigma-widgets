import Module from './widget/Module';
import Native from './Native';
import Applet, { Runnable } from './widget/Applet';
declare const _default: {
    Module: typeof Module;
    Native: typeof Native;
    Applet: typeof Applet;
    Runnable: typeof Runnable;
    Utils: {
        generator: {
            generateKey: () => string;
            prepareElement: (typeName: string, defaultProps: {
                [id: string]: import("./widget/props/BaseProp").default;
            }, overridenProps: {
                [id: string]: any;
            }, defaultStyles: {
                [id: string]: any;
            }, overridenStyles: {
                [id: string]: any;
            }, children: import("./widget/elements/BaseElement").default[]) => import("./widget/elements/BaseElement").default;
            nestedContext: (creature: import("./widget/Creature").default, otherMetas?: import("./widget/ExecutionMeta").default) => import("./widget/ExecutionMeta").default;
        };
        compiler: {
            extractModules: (middleCode: any, applet: Applet) => any;
        };
        json: {
            prettify: (obj: any) => string;
            diff: (obj1: any, obj2: any) => {};
        };
        executor: {
            executeSingle: (code: any, meta: import("./widget/ExecutionMeta").default) => any;
            executeBlock: (codes: any[], meta: import("./widget/ExecutionMeta").default) => any;
            ExecutionMeta: typeof import("./widget/ExecutionMeta").default;
        };
    };
};
export default _default;
