import type { CdpSession } from "../client/CdpSession.js";
import type { HwpJson20DocumentSnapshot } from "../models/types.js";
import { serializePageFunctionCall } from "./evaluation.js";
import { pageReadHwpJson20Snapshot } from "./pageFunctions.js";

export class HwpJson20Reader {
  constructor(private readonly session: CdpSession) {}

  async readSnapshot(): Promise<HwpJson20DocumentSnapshot | null> {
    return await this.session.evaluate<HwpJson20DocumentSnapshot | null>(
      serializePageFunctionCall(pageReadHwpJson20Snapshot)
    );
  }
}
