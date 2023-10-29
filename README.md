
# applet-vm

This is a tiny vm based on js to run on browser and run jsx safely.


The main goal of this project is to make developers to run untrusted jsx code on a VM in browser with isolation and full access to VM layers.

Also the project does what react js does by scanning and updating Dom with state changes of components so you can use the bundle with vanilla js to run jsx code directly on the browser.
## Installation

Install applet-vm with npm

```bash
  npm install applet-vm
```
    
## Usage/Examples

With 2 lines of code you can initiate the engine:

```JavaScript
import { Applet, Controls } from 'applet-vm';

let applet = new Applet('frame')
applet.fill(code)
```
The 'frame' is a string as applet key and you can pass any unique string to applet constructor. Also you can pass jsx code, a text containing list of class components, each component containing 3 methods:
  - constructor
  - onMount
  - render

applet-vm does the computation but it needs a UI driver to visualize the result UI.

For example by mixing applet-vm engine and applet-mwc driver you can build material design based GUI in browser:

```JavaScript
import { Applet, Controls } from 'applet-vm';
import MwcDriver from 'applet-mwc';

let applet = new Applet('frame')
applet.fill(code)

let driver = new MwcDriver(applet, document.getElementById('root'))
driver.start('Test', Controls)
```
The Controls object is a dictionary of global platform independent components which handle the computation and you only need to import it from applet-vm and pass it to driver start method.
The 'Test' in this example is name of class component which is root of UI. ( the genesis component)

## Screenshots

![sample1](https://raw.githubusercontent.com/cosmopole-org/sigma-widgets/master/Screenshot_2023-10-12-20-00-43-763_com.android.chrome~2.jpg)

The sample code can be found in this link :

https://github.com/cosmopole-org/sigma-widgets/blob/master/test/browser/Menu.js
