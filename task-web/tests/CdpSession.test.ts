import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CdpSession } from "../src/client/CdpSession.js";

class FakeWebSocket {
  static readonly OPEN = 1;

  static instances: FakeWebSocket[] = [];

  readonly listeners = new Map<string, Array<(event?: { data?: string }) => void>>();
  readonly sentPayloads: Array<{ id: number; method: string; params: Record<string, unknown> }> = [];
  readyState = FakeWebSocket.OPEN;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.emit("open");
    });
  }

  addEventListener(type: string, listener: (event?: { data?: string }) => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: (event?: { data?: string }) => void): void {
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter((candidate) => candidate !== listener)
    );
  }

  send(payload: string): void {
    const parsed = JSON.parse(payload) as {
      id: number;
      method: string;
      params: Record<string, unknown>;
    };
    this.sentPayloads.push(parsed);
    queueMicrotask(() => {
      this.emit("message", {
        data: JSON.stringify({
          id: parsed.id,
          result: {}
        })
      });
    });
  }

  close(): void {
    this.readyState = 3;
    queueMicrotask(() => {
      this.emit("close");
    });
  }

  emit(type: string, event?: { data?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("CdpSession", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("initializes runtime/page/dom domains on connect", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const session = new CdpSession();

    await session.connect("ws://chrome/devtools/page-1");

    expect(FakeWebSocket.instances[0]?.sentPayloads.map((payload) => payload.method)).toEqual([
      "Runtime.enable",
      "Page.enable",
      "DOM.enable"
    ]);
  });

  it("rejects send and sibling session creation when disconnected", async () => {
    const session = new CdpSession();

    await expect(session.send("Runtime.enable")).rejects.toMatchObject({
      name: "CdpProtocolError",
      message: "CDP WebSocket is not connected."
    });
    await expect(session.spawnSiblingSession()).rejects.toMatchObject({
      name: "CdpProtocolError",
      message: "CDP WebSocket is not connected."
    });
  });

  it("formats page evaluation exceptions using the runtime payload", async () => {
    const session = new CdpSession();
    vi.spyOn(session, "send").mockResolvedValue({
      result: {
        type: "undefined"
      },
      exceptionDetails: {
        exception: {
          value: { code: "BROKEN" }
        }
      }
    } as never);

    await expect(session.evaluate("window.throwError()")).rejects.toMatchObject({
      name: "CdpProtocolError",
      message: '{"code":"BROKEN"}'
    });
  });

  it("throws when setFileInputFiles cannot resolve the selector", async () => {
    const session = new CdpSession();
    vi.spyOn(session, "send")
      .mockResolvedValueOnce({
        root: {
          nodeId: 1
        }
      } as never)
      .mockResolvedValueOnce({
        nodeId: 0
      } as never);

    await expect(session.setFileInputFiles("#upload", ["/tmp/a.png"])).rejects.toMatchObject({
      name: "CdpProtocolError",
      message: "Could not resolve file input for selector #upload."
    });
  });

  it("times out pending commands when no websocket response arrives", async () => {
    vi.useFakeTimers();
    const session = new CdpSession();
    (session as unknown as { socket: { readyState: number; send: (payload: string) => void } }).socket = {
      readyState: 1,
      send: vi.fn()
    };

    const pending = session.send("Runtime.enable");
    const settled = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(settled).resolves.toMatchObject({
      name: "CdpProtocolError",
      message: "Timed out waiting for CDP response to Runtime.enable."
    });
  });

  it("rejects pending commands when the websocket reports an error payload", async () => {
    const session = new CdpSession();
    const fakeSocket = {
      readyState: 1,
      send: vi.fn((payload: string) => {
        const parsed = JSON.parse(payload) as { id: number };
        (session as unknown as { handleMessage: (message: string) => void }).handleMessage(
          JSON.stringify({
            id: parsed.id,
            error: {
              message: "Command failed."
            }
          })
        );
      })
    };
    (session as unknown as { socket: typeof fakeSocket }).socket = fakeSocket;

    await expect(session.send("Runtime.enable")).rejects.toMatchObject({
      name: "CdpProtocolError",
      message: "Command failed."
    });
  });
});
