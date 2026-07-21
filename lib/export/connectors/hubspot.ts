import { BaseConnector } from "./base";
import type { ConnectorDefinition, ConnectorResult, ExportPayload } from "./types";

export class HubSpotConnector extends BaseConnector {
  readonly definition: ConnectorDefinition = {
    id: "hubspot",
    name: "HubSpot",
    description: "Push leads directly to HubSpot CRM as contacts and companies.",
    icon: "Building2",
    isBuiltIn: false,
    configFields: [
      {
        key: "apiKey",
        label: "HubSpot API Key",
        type: "password",
        required: true,
        placeholder: "pat-xxxxx-xxxxx",
      },
      {
        key: "objectType",
        label: "Default Object Type",
        type: "select",
        required: true,
        options: [
          { label: "Contacts", value: "contacts" },
          { label: "Companies", value: "companies" },
          { label: "Deals", value: "deals" },
        ],
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
      message: "HubSpot integration is not yet available",
      error: "Coming soon — this connector will be enabled in a future release.",
    };
  }
}
