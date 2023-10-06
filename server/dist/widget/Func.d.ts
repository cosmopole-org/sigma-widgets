declare class Func {
    private _key;
    get key(): string;
    private _code;
    get code(): string;
    setCode(code: string): void;
    private _ast?;
    get ast(): any;
    setAst(ast: any): void;
    constructor(code: string, ast?: any);
}
export default Func;
