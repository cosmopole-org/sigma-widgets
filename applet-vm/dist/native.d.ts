import INative from "./widget/INative";
declare class Native extends INative {
    globalMemory: {};
    intervals: {};
    timeouts: {};
    controls: {};
    module: any;
    nativeElement: (compType: any, props: any, styles: any, children: any) => any;
    Object: {
        keys: (obj: any) => string[];
        values: (obj: any) => unknown[];
    };
    alert: (str: any) => void;
    console: {
        log: (...strs: any[]) => void;
    };
    setInterval: (callback: any, period: any) => void;
    setTimeout: (callback: any, timeout: any) => void;
    constructor(module: any, controls: any);
}
export default Native;
