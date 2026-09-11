import type { Connector, ConnectorDefinition, ConnectorResult, ExportPayload } from "./types";

export abstract class BaseConnector implements Connector {
  abstract readonly definition: ConnectorDefinition;

  abstract validate(config: Record<string, string>): string | null;

  abstract send(data: ExportPayload, config: Record<string, string>): Promise<ConnectorResult>;

  protected validateRequiredFields(config: Record<string, string>): string | null {
    for (const field of this.definition.configFields) {
      if (field.required && !config[field.key]?.trim()) {
        return `${field.label} is required`;
      }
    }
    return null;
  }
}
