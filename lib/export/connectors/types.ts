export interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  isBuiltIn: boolean;
  configFields: ConnectorConfigField[];
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface ConnectorInstance {
  id: string;
  enabled: boolean;
  config: Record<string, string>;
}

export interface ExportPayload {
  sessionId?: string;
  leads: Record<string, unknown>[];
  columns: ExportColumn[];
  format: "csv" | "xlsx" | "json";
}

export interface ExportColumn {
  key: string;
  label: string;
}

export interface ConnectorResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface Connector {
  readonly definition: ConnectorDefinition;
  validate(config: Record<string, string>): string | null;
  send(data: ExportPayload, config: Record<string, string>): Promise<ConnectorResult>;
}
