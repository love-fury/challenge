import type { CdpSession } from "../client/CdpSession.js";
import { serializePageFunctionCall } from "./evaluation.js";
import {
  pageExecuteDirectGotoPage,
  pageExecuteDirectActionCommand,
  pageExecuteDirectPropertyBagCommand,
  pageFinalizeInsertImageFileUpload,
  pagePrepareInsertImageFileUpload,
  pageReadDirectCommandState,
  pageReadSaveCommandState,
  pageReadWriteCommandStates,
  type DirectBagValues,
  type DirectCommandStateSnapshot,
  type ImageFileUploadPrepareResult,
  type SaveCommandStateSnapshot,
  type WriteCommandState,
  type WriteReplayResult
} from "./pageWriteFunctions.js";

export class HancomWriteDispatcher {
  constructor(private readonly session: CdpSession) {}

  async executeDirectGotoPage(pageNumber: number): Promise<WriteReplayResult> {
    return await this.session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageExecuteDirectGotoPage, pageNumber)
    );
  }

  async executeDirectPropertyBagCommand(
    commandId: number,
    bagValues: DirectBagValues
  ): Promise<WriteReplayResult> {
    return await this.session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageExecuteDirectPropertyBagCommand, commandId, bagValues)
    );
  }

  async executeDirectActionCommand(commandId: number): Promise<WriteReplayResult> {
    return await this.session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageExecuteDirectActionCommand, commandId)
    );
  }

  async readDirectCommandState(commandId: number): Promise<DirectCommandStateSnapshot> {
    return await this.session.evaluate<DirectCommandStateSnapshot>(
      serializePageFunctionCall(pageReadDirectCommandState, commandId)
    );
  }

  async readWriteCommandStates(selectors: string[]): Promise<WriteCommandState[]> {
    return await this.session.evaluate<WriteCommandState[]>(
      serializePageFunctionCall(pageReadWriteCommandStates, selectors)
    );
  }

  async readSaveCommandState(): Promise<SaveCommandStateSnapshot> {
    return await this.session.evaluate<SaveCommandStateSnapshot>(
      serializePageFunctionCall(pageReadSaveCommandState)
    );
  }

  async prepareInsertImageFileUpload(): Promise<ImageFileUploadPrepareResult> {
    return await this.session.evaluate<ImageFileUploadPrepareResult>(
      serializePageFunctionCall(pagePrepareInsertImageFileUpload)
    );
  }

  async finalizeInsertImageFileUpload(): Promise<WriteReplayResult> {
    return await this.session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageFinalizeInsertImageFileUpload)
    );
  }
}
