export interface DataSourceCapabilities {
  supportsTimeseries: boolean;
  supportsKpi: boolean;
  supportsTopology: boolean;
  supportsAlerts: boolean;
}

export interface WidgetQueryTarget {
  pluginId: string;
  semanticPathway: string[];
  uiState: Record<string, any>;
  label?: string;
}

export interface WidgetSchema {
  id: string;
  title: string;
  type: string;
  targets: WidgetQueryTarget[];
  layout: { x: number; y: number; w: number; h: number };
  settings: Record<string, any>;
}

export interface UnifiedQueryResponse {
  target: WidgetQueryTarget;
  datapoints: [number, number][]; // [Unix Milliseconds, Value]
}

export interface ConfiguredDataSource {
  id: string;
  pluginId: string;
  name: string;
  config: Record<string, any>;
}

export interface IDataSourceFrontendPlugin {
  id: string;
  name: string;
  capabilities: DataSourceCapabilities;
  QueryEditorComponent: React.ComponentType<{
    target: WidgetQueryTarget;
    onChange: (target: WidgetQueryTarget) => void;
  }>;
  GlobalConfigComponent?: React.ComponentType<{
    config: Record<string, any>;
    onChange: (config: Record<string, any>) => void;
  }>;
}
