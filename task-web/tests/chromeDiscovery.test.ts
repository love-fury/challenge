import { afterEach, describe, expect, it, vi } from "vitest";

import {
  discoverChromeTarget,
  listChromeTargets
} from "../src/client/chromeDiscovery.js";

const fetchMock = vi.fn();

describe("chromeDiscovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("lists Chrome targets with websocket endpoints only", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        {
          id: "page-1",
          type: "page",
          title: "Hancom",
          url: "https://webhwp.hancomdocs.com/webhwp/?docId=1",
          webSocketDebuggerUrl: "ws://chrome/page-1"
        },
        {
          id: "page-2",
          type: "page",
          title: "No socket",
          url: "https://example.com"
        }
      ])
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listChromeTargets({ host: "localhost", port: 9333 })).resolves.toEqual([
      {
        id: "page-1",
        type: "page",
        title: "Hancom",
        url: "https://webhwp.hancomdocs.com/webhwp/?docId=1",
        webSocketDebuggerUrl: "ws://chrome/page-1"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:9333/json/list", {
      signal: expect.any(AbortSignal)
    });
  });

  it("throws when the target list endpoint fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listChromeTargets()).rejects.toMatchObject({
      name: "EditorDiscoveryError",
      message: expect.stringContaining("/json/list (503)")
    });
  });

  it("prefers an explicit target id when provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        {
          id: "page-1",
          type: "page",
          title: "Hancom editor",
          url: "https://webhwp.hancomdocs.com/webhwp/?docId=1",
          webSocketDebuggerUrl: "ws://chrome/page-1"
        }
      ])
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(discoverChromeTarget({ targetId: "page-1" })).resolves.toMatchObject({
      id: "page-1"
    });
  });

  it("falls back to the title pattern when the url pattern does not match", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        {
          id: "page-1",
          type: "page",
          title: "Draft document",
          url: "https://example.com",
          webSocketDebuggerUrl: "ws://chrome/page-1"
        }
      ])
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      discoverChromeTarget({
        targetUrlPattern: "not-found",
        targetTitlePattern: "draft"
      })
    ).resolves.toMatchObject({
      id: "page-1"
    });
  });

  it("includes available page targets when no Hancom tab can be found", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        {
          id: "page-1",
          type: "page",
          title: "Docs",
          url: "https://example.com/docs",
          webSocketDebuggerUrl: "ws://chrome/page-1"
        },
        {
          id: "worker-1",
          type: "service_worker",
          title: "Worker",
          url: "https://example.com/sw.js",
          webSocketDebuggerUrl: "ws://chrome/worker-1"
        }
      ])
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(discoverChromeTarget()).rejects.toMatchObject({
      name: "EditorDiscoveryError",
      message: expect.stringContaining("Docs <https://example.com/docs>")
    });
  });
});
