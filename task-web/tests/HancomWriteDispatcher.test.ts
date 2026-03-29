import { describe, expect, it, vi } from "vitest";

import { HancomWriteDispatcher } from "../src/hancom/HancomWriteDispatcher.js";

describe("HancomWriteDispatcher", () => {
  it("forwards each direct command wrapper to session.evaluate with the expected page function", async () => {
    const session = {
      evaluate: vi.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ enabled: true, update: false })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce({ actorAvailable: true })
        .mockResolvedValueOnce({ ok: true, before: {}, after: {} })
        .mockResolvedValueOnce({ ok: true, selector: "#upload" })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })
    };
    const dispatcher = new HancomWriteDispatcher(session as never);

    await dispatcher.executeDirectGotoPage(9);
    await dispatcher.executeDirectPropertyBagCommand(10, { 1: "alpha" });
    await dispatcher.executeDirectActionCommand(11);
    await dispatcher.readDirectCommandState(12);
    await dispatcher.readWriteCommandStates(["[data-command='x']"]);
    await dispatcher.readSaveActorState();
    await dispatcher.executeSaveActorCommand(900);
    await dispatcher.prepareInsertImageFileUpload();
    await dispatcher.executeDirectInsertImageBlob("AAA=", "image/png");
    await dispatcher.finalizeInsertImageFileUpload();

    expect(session.evaluate).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("pageExecuteDirectGotoPage")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pageExecuteDirectPropertyBagCommand")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("pageExecuteDirectActionCommand")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("pageReadDirectCommandState")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("pageReadWriteCommandStates")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining("pageReadSaveActorState")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining("pageExecuteSaveActorCommand")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      8,
      expect.stringContaining("pagePrepareInsertImageFileUpload")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      9,
      expect.stringContaining("pageExecuteDirectInsertImageBlob")
    );
    expect(session.evaluate).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("pageFinalizeInsertImageFileUpload")
    );
  });
});
