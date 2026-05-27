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
