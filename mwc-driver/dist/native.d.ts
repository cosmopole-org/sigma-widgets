declare class Native {
    globalMemory: {};
    intervals: {};
    timeouts: {};
    controls: {};
    module: any;
    nativeElement: (compType: string, props: {
        [id: string]: any;
    }, styles: {
        [id: string]: any;
    }, children: Array<any>) => any;
    Object: {
        keys: (obj: any) => string[];
        values: (obj: any) => unknown[];
    };
    alert: (str: any) => void;
    console: {
        log: (...strs: Array<any>) => void;
    };
    setInterval: (callback: () => void, period: number) => void;
    setTimeout: (callback: () => void, timeout: number) => void;
    constructor(module: any, controls: {
        [id: string]: any;
    });
}
export default Native;
