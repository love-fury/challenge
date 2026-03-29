import type { CdpSession } from "../client/CdpSession.js";
import type { HwpJson20DocumentSnapshot } from "../models/types.js";
import { serializePageFunctionCall } from "./evaluation.js";
import {
  pageReadHwpJson20Snapshot,
  pageReadImageBase64Map,
  pageReadLiveImageSourceMap
} from "./pageFunctions.js";

export class HwpJson20Reader {
  constructor(private readonly session: CdpSession) {}

  async readSnapshot(): Promise<HwpJson20DocumentSnapshot | null> {
    return await this.session.evaluate<HwpJson20DocumentSnapshot | null>(
      serializePageFunctionCall(pageReadHwpJson20Snapshot)
    );
  }

  async readLiveImageSourceMap(): Promise<Record<string, string>> {
    return await this.session.evaluate<Record<string, string>>(
      serializePageFunctionCall(pageReadLiveImageSourceMap)
    );
  }

  async readImageBase64Map(
    sources: string[]
  ): Promise<Record<string, { mimeType?: string; base64: string }>> {
    return await this.session.evaluate<Record<string, { mimeType?: string; base64: string }>>(
      serializePageFunctionCall(pageReadImageBase64Map, sources)
    );
  }
}
