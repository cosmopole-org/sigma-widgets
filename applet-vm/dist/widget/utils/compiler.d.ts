import Applet from '../Applet';
declare function buildRule(key: any, value: any): string;
declare function buildValue(key: any, value: any): string;
declare function styleToCssString(rules: any): string;
declare const _default: {
    parse: (jsxCode: string) => import("acorn").Node;
    extractModules: (middleCode: any, applet: Applet) => any;
    styleToCssString: typeof styleToCssString;
    buildRule: typeof buildRule;
    buildValue: typeof buildValue;
};
export default _default;
