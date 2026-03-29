import type { CdpSession } from "../client/CdpSession.js";
import { serializePageFunctionCall } from "./evaluation.js";
import {
  pageExecuteDirectGotoPage,
  pageExecuteDirectActionCommand,
  pageExecuteDirectPropertyBagCommand,
  pageReadDirectCommandState,
  pageReadWriteCommandStates,
  type DirectBagValues,
  type DirectCommandStateSnapshot,
  type WriteCommandState,
  type WriteReplayResult
} from "./pageWriteFunctions.js";
import {
  pageExecuteDirectInsertImageBlob,
  pageFinalizeInsertImageFileUpload,
  pagePrepareInsertImageFileUpload,
  type DirectImageInsertReplayResult,
  type ImageFileUploadPrepareResult
} from "./pageInsertImageFunctions.js";
import {
  pageExecuteSaveActorCommand,
  pageReadSaveActorState,
  type SaveActorReplayResult,
  type SaveActorStateSnapshot
} from "./pageSaveFunctions.js";

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

  async readSaveActorState(): Promise<SaveActorStateSnapshot> {
    return await this.session.evaluate<SaveActorStateSnapshot>(
      serializePageFunctionCall(pageReadSaveActorState)
    );
  }

  async readSaveCommandState(): Promise<SaveActorStateSnapshot> {
    return this.readSaveActorState();
  }

  async executeSaveActorCommand(timeoutMs: number): Promise<SaveActorReplayResult> {
    return await this.session.evaluate<SaveActorReplayResult>(
      serializePageFunctionCall(pageExecuteSaveActorCommand, timeoutMs)
    );
  }

  async prepareInsertImageFileUpload(): Promise<ImageFileUploadPrepareResult> {
    return await this.session.evaluate<ImageFileUploadPrepareResult>(
      serializePageFunctionCall(pagePrepareInsertImageFileUpload)
    );
  }

  async executeDirectInsertImageBlob(
    base64: string,
    mimeType: string
  ): Promise<DirectImageInsertReplayResult> {
    return await this.session.evaluate<DirectImageInsertReplayResult>(
      serializePageFunctionCall(pageExecuteDirectInsertImageBlob, base64, mimeType)
    );
  }

  async finalizeInsertImageFileUpload(): Promise<WriteReplayResult> {
    return await this.session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageFinalizeInsertImageFileUpload)
    );
  }
}
