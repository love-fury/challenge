import type { EditorProbeSummary } from "../models/types.js";

export class HancomDocsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HancomDocsError";
  }
}

export class TargetDiscoveryError extends HancomDocsError {
  constructor(message: string) {
    super(message);
    this.name = "TargetDiscoveryError";
  }
}

export class EditorDiscoveryError extends TargetDiscoveryError {
  constructor(message: string) {
    super(message);
    this.name = "EditorDiscoveryError";
  }
}

export class CdpProtocolError extends HancomDocsError {
  constructor(message: string) {
    super(message);
    this.name = "CdpProtocolError";
  }
}

export class CapabilityUnavailableError extends HancomDocsError {
  readonly probe: EditorProbeSummary | undefined;

  constructor(message: string, probe?: EditorProbeSummary) {
    super(message);
    this.name = "CapabilityUnavailableError";
    this.probe = probe;
  }
}

export class UnsupportedOperationError extends CapabilityUnavailableError {
  constructor(message: string, probe?: EditorProbeSummary) {
    super(message, probe);
    this.name = "UnsupportedOperationError";
  }
}

export class EditorPreconditionError extends HancomDocsError {
  constructor(message: string) {
    super(message);
    this.name = "EditorPreconditionError";
  }
}

export class OperationTimeoutError extends HancomDocsError {
  constructor(message: string) {
    super(message);
    this.name = "OperationTimeoutError";
  }
}

export class ChromeLauncherError extends HancomDocsError {
  constructor(message: string) {
    super(message);
    this.name = "ChromeLauncherError";
  }
}
