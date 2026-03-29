import { describe, expect, it, vi } from "vitest";

import { HwpJson20Reader } from "../src/hancom/HwpJson20Reader.js";

describe("HwpJson20Reader", () => {
  it("reads the snapshot through the page serializer entrypoint", async () => {
    const session = {
      evaluate: vi.fn().mockResolvedValue({ ro: { p0: { tx: "Alpha" } } })
    };
    const reader = new HwpJson20Reader(session as never);

    await expect(reader.readSnapshot()).resolves.toEqual({ ro: { p0: { tx: "Alpha" } } });
    expect(session.evaluate).toHaveBeenCalledWith(expect.stringContaining("pageReadHwpJson20Snapshot"));
  });

  it("reads live image sources and base64 maps from page helpers", async () => {
    const session = {
      evaluate: vi.fn()
        .mockResolvedValueOnce({ "img-1": "blob:abc" })
        .mockResolvedValueOnce({ "blob:abc": { mimeType: "image/png", base64: "AAA=" } })
    };
    const reader = new HwpJson20Reader(session as never);

    await expect(reader.readLiveImageSourceMap()).resolves.toEqual({ "img-1": "blob:abc" });
    await expect(reader.readImageBase64Map(["blob:abc"])).resolves.toEqual({
      "blob:abc": {
        mimeType: "image/png",
        base64: "AAA="
      }
    });
    expect(session.evaluate).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("pageReadLiveImageSourceMap")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('["blob:abc"]')
    );
  });
});
