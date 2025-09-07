/**
 * A singleton instance of the VSCode API.
 * This ensures that `acquireVsCodeApi` is called only once.
 */
import { VsCodeWebViewApi } from "./types";

// The conditional check is to ensure that the code can run in a browser environment
// for testing purposes, where `acquireVsCodeApi` is not available.
const vscodeApi: VsCodeWebViewApi = typeof acquireVsCodeApi === 'function'
  ? acquireVsCodeApi()
  : {
      postMessage: (message: any) => {
        console.log("postMessage (mock)", message);
      },
      getState: () => {
        console.log("getState (mock)");
        return {};
      },
      setState: (state: any) => {
        console.log("setState (mock)", state);
        return {};
      }
    };

export default vscodeApi;
