import type { CdpSession } from "../client/CdpSession.js";
import type {
  CaretPosition,
  CaretTarget,
  DeleteTableRowRequest,
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
} from "../models/types.js";
import { HancomReadService } from "./HancomReadService.js";
import { HancomWriteService } from "./HancomWriteService.js";

export class HancomBridge {
  private readonly readService: HancomReadService;

  private readonly writeService: HancomWriteService;

  constructor(session: CdpSession) {
    this.readService = new HancomReadService(session);
    this.writeService = new HancomWriteService(session);
  }

  async readDocument(): Promise<HancomDocument> {
    return await this.readService.readDocument();
  }

  async readText(): Promise<string> {
    return await this.readService.readText();
  }

  async readStructure(): Promise<HancomDocument["blocks"]> {
    return await this.readService.readStructure();
  }

  async getParagraphFormatting(locator: ParagraphLocator): Promise<ParagraphFormattingResult> {
    return await this.readService.getParagraphFormatting(locator);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    return await this.readService.search(query, options);
  }

  async getCaretPosition(): Promise<CaretPosition> {
    return await this.readService.getCaretPosition();
  }

  async moveCaret(target: CaretTarget): Promise<CaretPosition> {
    return await this.writeService.moveCaret(target);
  }

  async typeText(text: string): Promise<void> {
    await this.writeService.typeText(text);
  }

  async replaceAll(request: ReplaceAllRequest): Promise<ReplaceAllResult> {
    return await this.writeService.replaceAll(request);
  }

  async insertTable(request: InsertTableRequest): Promise<InsertTableResult> {
    return await this.writeService.insertTable(request);
  }

  async fillTableCells(request: FillTableCellsRequest): Promise<FillTableCellsResult> {
    return await this.writeService.fillTableCells(request);
  }

  async save(options: SaveOptions = {}): Promise<SaveResult> {
    return await this.writeService.save(options);
  }

  async gotoPage(pageNumber: number): Promise<PageNavigationResult> {
    return await this.writeService.gotoPage(pageNumber);
  }

  async insertImage(request: InsertImageRequest): Promise<ImageInsertResult> {
    return await this.writeService.insertImage(request);
  }

  async insertTableRow(request: InsertTableRowRequest): Promise<TableMutationResult> {
    return await this.writeService.insertTableRow(request);
  }

  async deleteTableRow(request: DeleteTableRowRequest): Promise<TableMutationResult> {
    return await this.writeService.deleteTableRow(request);
  }

  async insertImageFromFile(imagePath: string): Promise<void> {
    await this.writeService.insertImageFromFile(imagePath);
  }

  async dispose(): Promise<void> {
    await this.writeService.dispose();
  }
}
