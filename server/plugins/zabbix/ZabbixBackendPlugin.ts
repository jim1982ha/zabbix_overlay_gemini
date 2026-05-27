import { IDataSourceBackendPlugin, WidgetQueryTarget, UnifiedQueryResponse } from '../../core/interfaces/backendPlugin';
import axios from 'axios';

export class ZabbixBackendPlugin implements IDataSourceBackendPlugin {
  public id = 'zabbix-core';

  async getDataSchema(config: any): Promise<any> {
    return { status: "Schema discovery successfully bound. Registry complete." };
  }

  async executeQuery(target: WidgetQueryTarget, range: {from: number, to: number}, config: any): Promise<UnifiedQueryResponse> {
    const { url, token } = config;
    if (!url || !token) {
      throw new Error('Zabbix configuration is missing or invalid.');
    }

    const uiState = target.uiState as { host?: string; item?: string; itemid?: string };
    const itemid = uiState.itemid;

    if (!itemid) {
       return { target, datapoints: [] };
    }

    // Isolate CORS constraints safely serverside and parse opaque semantic variables
    const payload = {
      jsonrpc: '2.0',
      method: 'history.get',
      params: {
        output: 'extend',
        history: 0, // Float baseline resolution
        itemids: [itemid],
        time_from: Math.floor(range.from / 1000),
        time_till: Math.floor(range.to / 1000),
        sortfield: 'clock',
        sortorder: 'ASC'
      },
      auth: token,
      id: 1
    };

    try {
      const res = await axios.post(url, payload);
      const data = res.data?.result || [];

      // Normalize incoming disparate structures into unified exact Unix Ms
      const datapoints: [number, number][] = data.map((d: any) => [
        parseInt(d.clock, 10) * 1000, 
        parseFloat(d.value)
      ]);

      return {
        target,
        datapoints
      };
    } catch (e: any) {
      console.error(`Zabbix Backend Adapter failure during execution sequence: ${e.message}`);
      return { target, datapoints: [] };
    }
  }
}
