import { connectorRegistry } from "./connectors/registry";
import type { ExportPayload } from "./connectors/types";

export interface WebhookDeliveryResult {
  success: boolean;
  connectorId: string;
  message: string;
  error?: string;
}

export async function deliverToConnector(
  connectorId: string,
  config: Record<string, string>,
  payload: ExportPayload,
): Promise<WebhookDeliveryResult> {
  const connector = connectorRegistry.get(connectorId);
  if (!connector) {
    return {
      success: false,
      connectorId,
      message: `Connector "${connectorId}" not found`,
      error: `No registered connector with id "${connectorId}"`,
    };
  }

  const result = await connector.send(payload, config);
  return {
    success: result.success,
    connectorId,
    message: result.message,
    error: result.error,
  };
}

export async function deliverToMultipleConnectors(
  deliveries: { connectorId: string; config: Record<string, string>; payload: ExportPayload }[],
): Promise<WebhookDeliveryResult[]> {
  return Promise.all(
    deliveries.map((d) => deliverToConnector(d.connectorId, d.config, d.payload)),
  );
}
