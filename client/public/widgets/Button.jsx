
import React from "react";

class Button extends BaseComponent {

    constructor(props) {
        super(props)
    }

    onStart() {
        console.log('button widget started.');
    }

    onChange(key, newValue) {
        console.log('button ' + key + ' changed to ' + newValue)
    }

    render() {
        return (
            <div>
                <button style={{ width: 200, height: 200, backgroundColor: 'green' }} />
            </div>
        );
    }
}
