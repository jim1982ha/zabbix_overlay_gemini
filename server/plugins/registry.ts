import { IDataSourceBackendPlugin } from '../core/interfaces/backendPlugin';
import { ZabbixBackendPlugin } from './zabbix/ZabbixBackendPlugin';

const registry = new Map<string, IDataSourceBackendPlugin>();

export function registerPlugin(plugin: IDataSourceBackendPlugin) {
  registry.set(plugin.id, plugin);
}

export function getPlugin(id: string): IDataSourceBackendPlugin | undefined {
  return registry.get(id);
}

// Statically register plugins
registerPlugin(new ZabbixBackendPlugin());
