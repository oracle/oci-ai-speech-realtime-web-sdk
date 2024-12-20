# Oracle Cloud Infrastructure Realtime Speech TypeScript SDK Development

## Installation

To perform this and the subsequent steps, make sure you're in the right directory.

```bash
cd oci-ai-speech-realtime-web-sdk/ai-speech-realtime-sdk-web/
```

Run the following to install the (dev) dependencies of the SDK into your workspace.

```bash
npm install
```
## Unit Tests

To run unit tests, do the following:
```bash
npm run test
```

You can generate the coverage report by doing 
```bash
npm run test -- --coverage
``` 

The coverage report will be available in the `coverage/lcov-report` directory. You can open the `index.html` file in the browser.

## Build
To compile the TypeScript files into JavaScript files, run the following:

```bash
npm run build
```

 