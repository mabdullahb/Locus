import { BaseConnector } from "./base";
import type { ConnectorDefinition, ConnectorResult, ExportPayload } from "./types";

const WEBHOOK_TIMEOUT = 15000;

export class WebhookConnector extends BaseConnector {
  readonly definition: ConnectorDefinition = {
    id: "webhook",
    name: "Generic Webhook",
    description: "Send data to any webhook URL — compatible with n8n, Zapier, Make, and custom endpoints.",
    icon: "Webhook",
    isBuiltIn: true,
    configFields: [
      {
        key: "webhookUrl",
        label: "Webhook URL",
        type: "url",
        required: true,
        placeholder: "https://hooks.example.com/endpoint",
      },
      {
        key: "secret",
        label: "Secret (optional)",
        type: "password",
        required: false,
        placeholder: "Shared secret for HMAC signing",
      },
    ],
  };

  validate(config: Record<string, string>): string | null {
    const missing = this.validateRequiredFields(config);
    if (missing) return missing;

    try {
      new URL(config.webhookUrl);
    } catch {
      return "Webhook URL must be a valid URL";
    }

    return null;
  }

  async send(data: ExportPayload, config: Record<string, string>): Promise<ConnectorResult> {
    const validationError = this.validate(config);
    if (validationError) {
      return { success: false, message: "Invalid configuration", error: validationError };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Locus-Export/1.0",
      };

      if (config.secret) {
        headers["X-Webhook-Secret"] = config.secret;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "leads.export",
          timestamp: new Date().toISOString(),
          sessionId: data.sessionId,
          format: data.format,
          totalCount: data.leads.length,
          columns: data.columns,
          data: data.leads,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text().catch(() => "No response body");
        return {
          success: false,
          message: `Webhook responded with ${response.status}`,
          error: body.slice(0, 500),
        };
      }

      return { success: true, message: `Webhook delivered (${response.status})` };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message: "Webhook delivery failed",
        error: errorMessage,
      };
    }
  }
}
