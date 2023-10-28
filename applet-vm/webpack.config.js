
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
console.log('__filename: ', __filename)

const __dirname = path.dirname(__filename);

export default {
    mode: "development",
    devtool: "inline-source-map",
    entry: {
        main: "./index.ts",
    },
    output: {
        path: path.resolve(__dirname, './build'),
        filename: "applet-bundle.js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            }
        ]
    }
}