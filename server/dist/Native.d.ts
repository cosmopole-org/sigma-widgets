import INative from "./widget/INative";
declare class Native extends INative {
    private globalMemory;
    private intervals;
    private timeouts;
    readonly console: {
        log: (...strs: Array<any>) => void;
    };
    readonly setInterval: (callback: any, period: number) => void;
    readonly setTimeout: (callback: any, timeout: number) => void;
}
export default Native;
