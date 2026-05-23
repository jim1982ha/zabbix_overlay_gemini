export interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
}

export interface SeriesConfig {
  metric: string;
  host: string;
  metrics?: string[];
  hosts?: string[];
  yAxis: 'left' | 'right';
  chartType: 'line' | 'bar' | 'area' | 'pie';
  aggregation: 'none' | 'sum' | 'avg';
  stacked: boolean;
}

export interface Widget {
  id: string;
  type: 'kpi' | 'chart';
  title: string;
  metrics: string[];
  hosts: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  chartType?: 'line' | 'bar' | 'area' | 'pie' | 'mixed';
  seriesConfig?: Record<string, SeriesConfig>;
  aggregation?: 'none' | 'sum' | 'avg';
  stacked?: boolean;
}

export interface ZabbixConfig {
  url: string;
  token: string;
  isPreconfigured: boolean;
}

export interface ZabbixHost {
  hostid: string;
  name?: string;
  host: string;
}

export interface ZabbixItem {
  itemid: string;
  name: string;
  value_type: string;
  lastvalue: string;
  units?: string;
  hosts?: ZabbixHost[];
}

export interface ZabbixHostResponse {
  result: ZabbixHost[];
}

export interface ZabbixItemResponse {
  result: ZabbixItem[];
}
