/* eslint-disable max-lines */

import { CdpProtocolError } from "./errors.js";

interface CdpSuccessResponse<TResult> {
  id: number;
  result: TResult;
}

interface CdpErrorResponse {
  id: number;
  error: {
    message: string;
    code?: number;
  };
}

interface RuntimeEvaluateResult {
  result: {
    type: string;
    value?: unknown;
    description?: string;
  };
  exceptionDetails?: {
    text?: string;
    exception?: {
      description?: string;
      value?: unknown;
    };
  };
}

interface DomGetDocumentResult {
  root: {
    nodeId: number;
  };
}

interface DomQuerySelectorResult {
  nodeId: number;
}

type PendingCommand = {
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class CdpSession {
  private nextMessageId = 1;
  private readonly pendingCommands = new Map<number, PendingCommand>();
  private socket: WebSocket | null = null;
  private webSocketDebuggerUrl: string | null = null;

  async connect(webSocketDebuggerUrl: string): Promise<void> {
    if (this.socket) {
      return;
    }

    const socket = new WebSocket(webSocketDebuggerUrl);
    this.socket = socket;
    this.webSocketDebuggerUrl = webSocketDebuggerUrl;

    await new Promise<void>((resolve, reject) => {
      const handleOpen = (): void => {
        socket.removeEventListener("error", handleError);
        resolve();
      };

      const handleError = (): void => {
        socket.removeEventListener("open", handleOpen);
        reject(new CdpProtocolError(`Failed to open CDP WebSocket ${webSocketDebuggerUrl}.`));
      };

      socket.addEventListener("message", (event) => {
        this.handleMessage(typeof event.data === "string" ? event.data : String(event.data));
      });
      socket.addEventListener("close", () => {
        this.failPendingCommands(new CdpProtocolError("CDP WebSocket closed."));
        this.socket = null;
      });
      socket.addEventListener("open", handleOpen, { once: true });
      socket.addEventListener("error", handleError, { once: true });
    });

    await this.send("Runtime.enable");
    await this.send("Page.enable");
    await this.send("DOM.enable");
  }

  async close(): Promise<void> {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;

    await new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
      socket.close();
    });
  }

  async spawnSiblingSession(): Promise<CdpSession> {
    if (this.webSocketDebuggerUrl === null) {
      throw new CdpProtocolError("CDP WebSocket is not connected.");
    }

    const sibling = new CdpSession();
    await sibling.connect(this.webSocketDebuggerUrl);
    return sibling;
  }

  async send<TResult>(method: string, params: Record<string, unknown> = {}): Promise<TResult> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new CdpProtocolError("CDP WebSocket is not connected.");
    }

    const id = this.nextMessageId++;
    const payload = JSON.stringify({ id, method, params });

    return await new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new CdpProtocolError(`Timed out waiting for CDP response to ${method}.`));
      }, 10_000);

      this.pendingCommands.set(id, {
        resolve: (value) => resolve(value as TResult),
        reject,
        timer
      });

      this.socket?.send(payload);
    });
  }

  async bringToFront(): Promise<void> {
    await this.send("Page.bringToFront");
  }

  async evaluate<TResult>(expression: string): Promise<TResult> {
    const response = await this.send<RuntimeEvaluateResult>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });

    if (response.exceptionDetails) {
      const description =
        response.exceptionDetails.exception?.description ??
        response.exceptionDetails.exception?.value ??
        response.exceptionDetails.text ??
        "Unknown page evaluation error";

      throw new CdpProtocolError(formatUnknownValue(description));
    }

    return response.result.value as TResult;
  }

  async insertText(text: string): Promise<void> {
    await this.bringToFront();
    await this.send("Input.insertText", { text });
  }

  async pressTab(): Promise<void> {
    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9
    });
  }

  async pressShiftTab(): Promise<void> {
    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Shift",
      code: "ShiftLeft",
      windowsVirtualKeyCode: 16,
      nativeVirtualKeyCode: 16
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      modifiers: 8
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      modifiers: 8
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Shift",
      code: "ShiftLeft",
      windowsVirtualKeyCode: 16,
      nativeVirtualKeyCode: 16
    });
  }

  async pressArrowLeft(): Promise<void> {
    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "ArrowLeft",
      code: "ArrowLeft",
      windowsVirtualKeyCode: 37,
      nativeVirtualKeyCode: 37
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowLeft",
      code: "ArrowLeft",
      windowsVirtualKeyCode: 37,
      nativeVirtualKeyCode: 37
    });
  }

  async pressEscape(): Promise<void> {
    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27
    });
  }

  async pressEnter(): Promise<void> {
    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13
    });
  }

  async pressF2(): Promise<void> {
    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "F2",
      code: "F2",
      windowsVirtualKeyCode: 113,
      nativeVirtualKeyCode: 113
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "F2",
      code: "F2",
      windowsVirtualKeyCode: 113,
      nativeVirtualKeyCode: 113
    });
  }

  async pressF5(): Promise<void> {
    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "F5",
      code: "F5",
      windowsVirtualKeyCode: 116,
      nativeVirtualKeyCode: 116
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "F5",
      code: "F5",
      windowsVirtualKeyCode: 116,
      nativeVirtualKeyCode: 116
    });
  }

  async pressShortcut(key: string, modifier: "Control" | "Meta"): Promise<void> {
    await this.bringToFront();
    const modifierCode = modifier === "Meta" ? "MetaLeft" : "ControlLeft";
    const modifierKeyCode = modifier === "Meta" ? 91 : 17;
    const modifiers = modifier === "Meta" ? 4 : 2;
    const upperKey = key.toUpperCase();
    const code = upperKey.length === 1 ? `Key${upperKey}` : upperKey;
    const keyCode = upperKey.length === 1 ? upperKey.charCodeAt(0) : 0;

    await this.bringToFront();
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: modifier,
      code: modifierCode,
      windowsVirtualKeyCode: modifierKeyCode,
      nativeVirtualKeyCode: modifierKeyCode
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: upperKey,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      modifiers
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: upperKey,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      modifiers
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: modifier,
      code: modifierCode,
      windowsVirtualKeyCode: modifierKeyCode,
      nativeVirtualKeyCode: modifierKeyCode
    });
  }

  async setFileInputFiles(selector: string, files: string[]): Promise<void> {
    const documentRoot = await this.send<DomGetDocumentResult>("DOM.getDocument", {
      depth: 0
    });
    const query = await this.send<DomQuerySelectorResult>("DOM.querySelector", {
      nodeId: documentRoot.root.nodeId,
      selector
    });
    if (query.nodeId === 0) {
      throw new CdpProtocolError(`Could not resolve file input for selector ${selector}.`);
    }

    await this.send("DOM.setFileInputFiles", {
      nodeId: query.nodeId,
      files
    });
  }

  private handleMessage(message: string): void {
    const parsed = JSON.parse(message) as CdpSuccessResponse<unknown> | CdpErrorResponse;

    if (!("id" in parsed)) {
      return;
    }

    const pendingCommand = this.pendingCommands.get(parsed.id);
    if (!pendingCommand) {
      return;
    }

    clearTimeout(pendingCommand.timer);
    this.pendingCommands.delete(parsed.id);

    if ("error" in parsed) {
      pendingCommand.reject(new CdpProtocolError(parsed.error.message));
      return;
    }

    pendingCommand.resolve(parsed.result);
  }

  private failPendingCommands(error: Error): void {
    for (const [id, pendingCommand] of this.pendingCommands.entries()) {
      clearTimeout(pendingCommand.timer);
      pendingCommand.reject(error);
      this.pendingCommands.delete(id);
    }
  }
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown page evaluation error";
  }
}
