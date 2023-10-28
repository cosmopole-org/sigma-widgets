declare namespace _default {
    let mode: string;
    let devtool: string;
    namespace entry {
        let main: string;
    }
    namespace output {
        let path: string;
        let filename: string;
    }
    namespace resolve {
        let extensions: string[];
    }
    namespace module {
        let rules: {
            test: RegExp;
            loader: string;
        }[];
    }
}
export default _default;
