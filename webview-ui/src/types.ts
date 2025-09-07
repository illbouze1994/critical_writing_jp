/**
 * Defines the shape of the VS Code API that the webview can interact with.
 * This is a subset of the actual `WebviewApi` from `vscode-webview`.
 */
export interface VsCodeWebViewApi {
  postMessage(message: any): void;
  getState(): any;
  setState(newState: any): any;
}
