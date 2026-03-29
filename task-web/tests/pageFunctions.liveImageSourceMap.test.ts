import { afterEach, describe, expect, it } from "vitest";

import { pageReadLiveImageSourceMap } from "../src/hancom/pageFunctions.js";

type RuntimeGlobal = typeof globalThis & {
  HwpApp?: unknown;
};

describe("pageReadLiveImageSourceMap", () => {
  const runtime = globalThis as RuntimeGlobal;
  const originalHwpApp = runtime.HwpApp;

  afterEach(() => {
    runtime.HwpApp = originalHwpApp;
  });

  it("prefers computed document resource URLs over blob cache URLs", () => {
    runtime.HwpApp = {
      document: {
        Ivr: {
          u6n: {
            U4n: [{ FFi: "asset-top.png" }]
          }
        }
      },
      cache: {
        images: {
          "asset-top.png": {
            currentSrc: "blob:temporary-preview"
          }
        }
      },
      IMGLOADER: {
        KYs: (resourceName: string) =>
          `https://webhwp.hancomdocs.com/webhwp/resource/doc/html/files/session/hash/${resourceName}`
      }
    };

    expect(pageReadLiveImageSourceMap()).toEqual({
      "asset-top.png":
        "https://webhwp.hancomdocs.com/webhwp/resource/doc/html/files/session/hash/asset-top.png"
    });
  });

  it("falls back to live cache URLs when the runtime resource builder is unavailable", () => {
    runtime.HwpApp = {
      document: {
        Ivr: {
          u6n: {
            U4n: [{ FFi: "asset-top.png" }]
          }
        }
      },
      cache: {
        images: {
          "asset-top.png": {
            currentSrc: "blob:temporary-preview"
          }
        }
      }
    };

    expect(pageReadLiveImageSourceMap()).toEqual({
      "asset-top.png": "blob:temporary-preview"
    });
  });
});
