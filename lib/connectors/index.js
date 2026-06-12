// Connector gateway: routes an intent (lookup_order, lookup_ticket, ...)
// to the workspace's active data source. Every adapter implements the same
// shape: query(intent, params, config) -> { found, data, error? }.
import { readStore } from '@/lib/store';
import * as demo from './demo';
import * as rest from './rest';
import * as postgres from './postgres';

const ADAPTERS = { demo, rest, postgres };

export function getConnectorConfig(store) {
  return store?.connector || { type: 'demo' };
}

// Run an intent against the active connector. `override` lets the Test
// endpoint try an unsaved config without persisting it.
export async function runConnector(intent, params, override) {
  const connector = override || getConnectorConfig(await readStore());
  const type = connector.type || 'demo';
  const adapter = ADAPTERS[type] || demo;
  const config = connector[type] || {};
  return adapter.query(intent, params, config);
}
