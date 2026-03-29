import { CdpSession } from "./client/CdpSession.js";
import { discoverChromeTarget } from "./client/chromeDiscovery.js";
import { HancomBridge } from "./hancom/HancomBridge.js";
import type {
  CaretPosition,
  CaretTarget,
  ChromeTargetInfo,
  ConnectionOptions,
  DeleteTableRowRequest,
  DocumentBlock,
  FillTableCellsRequest,
  FillTableCellsResult,
  HancomDocument,
  ImageInsertResult,
  InsertImageRequest,
  InsertTableRequest,
  InsertTableResult,
  InsertTableRowRequest,
  PageNavigationResult,
  ParagraphFormattingResult,
  ParagraphLocator,
  ReplaceAllRequest,
  ReplaceAllResult,
  SearchOptions,
  SearchResult,
  SaveOptions,
  SaveResult,
  TableMutationResult
} from "./models/types.js";

export class HancomDocsClient {
  static async connect(options: ConnectionOptions = {}): Promise<HancomDocsClient> {
    const target = await discoverChromeTarget(options);
    const session = new CdpSession();
    await session.connect(target.webSocketDebuggerUrl);
    const bridge = new HancomBridge(session);

    return new HancomDocsClient(target, session, bridge);
  }

  private constructor(
    readonly target: ChromeTargetInfo,
    private readonly session: CdpSession,
    private readonly bridge: HancomBridge
  ) {}

  async disconnect(): Promise<void> {
    await this.bridge.dispose();
    await this.session.close();
  }

  async readDocument(): Promise<HancomDocument> {
    return await this.bridge.readDocument();
  }

  async readText(): Promise<string> {
    return await this.bridge.readText();
  }

  async readStructure(): Promise<DocumentBlock[]> {
    return await this.bridge.readStructure();
  }

  async getParagraphFormatting(locator: ParagraphLocator): Promise<ParagraphFormattingResult> {
    return await this.bridge.getParagraphFormatting(locator);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    return await this.bridge.search(query, options);
  }

  async moveCaret(target: CaretTarget): Promise<CaretPosition> {
    return await this.bridge.moveCaret(target);
  }

  async getCaretPosition(): Promise<CaretPosition> {
    return await this.bridge.getCaretPosition();
  }

  async typeText(text: string): Promise<void> {
    await this.bridge.typeText(text);
  }

  async replaceAll(request: ReplaceAllRequest): Promise<ReplaceAllResult> {
    return await this.bridge.replaceAll(request);
  }

  async insertTable(request: InsertTableRequest): Promise<InsertTableResult> {
    return await this.bridge.insertTable(request);
  }

  async fillTableCells(request: FillTableCellsRequest): Promise<FillTableCellsResult> {
    return await this.bridge.fillTableCells(request);
  }

  async gotoPage(pageNumber: number): Promise<PageNavigationResult> {
    return await this.bridge.gotoPage(pageNumber);
  }

  async insertImage(request: InsertImageRequest): Promise<ImageInsertResult> {
    return await this.bridge.insertImage(request);
  }

  async insertTableRow(request: InsertTableRowRequest): Promise<TableMutationResult> {
    return await this.bridge.insertTableRow(request);
  }

  async deleteTableRow(request: DeleteTableRowRequest): Promise<TableMutationResult> {
    return await this.bridge.deleteTableRow(request);
  }

  async save(options: SaveOptions = {}): Promise<SaveResult> {
    return await this.bridge.save(options);
  }
}
