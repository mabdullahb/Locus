import { BaseConnector } from "./base";
import type { ConnectorDefinition, ConnectorResult, ExportPayload } from "./types";

export class SalesforceConnector extends BaseConnector {
  readonly definition: ConnectorDefinition = {
    id: "salesforce",
    name: "Salesforce",
    description: "Sync leads and contacts to Salesforce CRM using the REST API.",
    icon: "Cloud",
    isBuiltIn: false,
    configFields: [
      {
        key: "instanceUrl",
        label: "Instance URL",
        type: "url",
        required: true,
        placeholder: "https://your-instance.salesforce.com",
      },
      {
        key: "apiVersion",
        label: "API Version",
        type: "text",
        required: false,
        placeholder: "v62.0",
      },
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        required: true,
        placeholder: "Salesforce OAuth access token",
      },
    ],
  };

  validate(config: Record<string, string>): string | null {
    return this.validateRequiredFields(config);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_data: ExportPayload, _config: Record<string, string>): Promise<ConnectorResult> {
    return {
      success: false,
      message: "Salesforce integration is not yet available",
      error: "Coming soon — this connector will be enabled in a future release.",
    };
  }
}
