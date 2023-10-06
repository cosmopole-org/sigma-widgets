"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const INative_1 = require("./widget/INative");
class Native extends INative_1.default {
    constructor() {
        super(...arguments);
        this.globalMemory = {};
        this.intervals = {};
        this.timeouts = {};
        this.console = {
            log: (...strs) => {
                console.log(...strs);
            }
        };
        this.setInterval = (callback, period) => {
            this.intervals[setInterval(callback, period) + ''] = true;
        };
        this.setTimeout = (callback, timeout) => {
            this.timeouts[setTimeout(callback, timeout) + ''] = true;
        };
    }
}
exports.default = Native;
//# sourceMappingURL=Native.js.map