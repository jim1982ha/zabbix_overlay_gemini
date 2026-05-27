import { IDataSourceFrontendPlugin } from '../core/interfaces/plugins';
import { ZabbixFrontendPlugin } from './zabbix/ZabbixFrontendPlugin';

const registry = new Map<string, IDataSourceFrontendPlugin>();

export function registerPlugin(plugin: IDataSourceFrontendPlugin) {
  registry.set(plugin.id, plugin);
}

export function getPlugin(id: string): IDataSourceFrontendPlugin | undefined {
  return registry.get(id);
}

export function getAllPlugins(): IDataSourceFrontendPlugin[] {
  return Array.from(registry.values());
}

// Statically register plugins at compile time
registerPlugin(ZabbixFrontendPlugin);
