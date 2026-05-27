export interface WidgetQueryTarget {
  pluginId: string;
  semanticPathway: string[];
  uiState: Record<string, any>;
  label?: string;
}

export interface UnifiedQueryResponse {
  target: WidgetQueryTarget;
  datapoints: [number, number][]; // [Unix Timestamp in MS, Value]
}

export interface IDataSourceBackendPlugin {
  id: string;
  getDataSchema(config: any): Promise<any>;
  executeQuery(target: WidgetQueryTarget, range: {from: number, to: number}, config: any): Promise<UnifiedQueryResponse>;
}
