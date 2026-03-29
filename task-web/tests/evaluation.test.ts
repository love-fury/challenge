import { describe, expect, it } from "vitest";

import { serializePageFunctionCall } from "../src/hancom/evaluation.js";

describe("serializePageFunctionCall", () => {
  it("injects the runtime-global shim needed by stringified page functions", () => {
    const expression = serializePageFunctionCall<[]>(function pageProbe(): string {
      return "probe";
    });

    expect(expression).toContain("const getRuntimeGlobal = () => globalThis;");
    expect(expression).toContain("return (function pageProbe()");
  });
});
