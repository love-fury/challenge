import type { HancomDocument, HwpJson20DocumentSnapshot } from "../models/types.js";
import { parseHwpJson20Document } from "./hwpJson20.js";

export class HwpJson20Codec {
  parse(snapshot: HwpJson20DocumentSnapshot): HancomDocument {
    return parseHwpJson20Document(snapshot);
  }
}
