import type { Connector, ConnectorDefinition } from "./types";
import { WebhookConnector } from "./webhook";
import { HubSpotConnector } from "./hubspot";
import { SalesforceConnector } from "./salesforce";

class ConnectorRegistry {
  private connectors = new Map<string, Connector>();

  constructor() {
    this.register(new WebhookConnector());
    this.register(new HubSpotConnector());
    this.register(new SalesforceConnector());
  }

  register(connector: Connector): void {
    this.connectors.set(connector.definition.id, connector);
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getAll(): ConnectorDefinition[] {
    return Array.from(this.connectors.values()).map((c) => c.definition);
  }

  getAvailable(): ConnectorDefinition[] {
    return Array.from(this.connectors.values())
      .filter((c) => c.definition.isBuiltIn)
      .map((c) => c.definition);
  }

  getComingSoon(): ConnectorDefinition[] {
    return Array.from(this.connectors.values())
      .filter((c) => !c.definition.isBuiltIn)
      .map((c) => c.definition);
  }
}

export const connectorRegistry = new ConnectorRegistry();
