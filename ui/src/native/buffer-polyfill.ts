import * as bufferModule from "buffer";

const browserBuffer = bufferModule.Buffer;

if (typeof globalThis.Buffer === "undefined") {
  Object.defineProperty(globalThis, "Buffer", {
    configurable: true,
    value: browserBuffer,
  });
}
