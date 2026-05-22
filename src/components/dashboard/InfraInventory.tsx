import React, { useState, useEffect, useCallback } from 'react';
import { Server, Cpu, HardDrive, Database, Zap, Activity, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FilterBar, FilterButton } from '../ui/FilterBar';
import { STDL_LIST_CARD_CLASS } from '../ui/Card';
import axios from 'axios';

export function InfraInventory({ filters, globalSearch = "", zabbixConfig, showToast }: { filters: any, globalSearch?: string, zabbixConfig?: { url: string, token: string }, showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void }) {
  const isHistorical = filters.mode === 'historical';
  const [activeHostGroup, setActiveHostGroup] = React.useState<string>('all');
  
  const isDemo = !zabbixConfig?.url || !zabbixConfig?.token;
  const [zabbixAssets, setZabbixAssets] = useState<any[]>([]);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  const fetchZabbixAssets = useCallback(async () => {
    if (isDemo) return;
    try {
      const response = await axios.post("/api/zabbix", {
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        method: "host.get",
        params: {
          output: ["hostid", "host", "name", "status", "description"],
          selectHostGroups: ["groupid", "name"]
        }
      });
      if (response.data.result) {
        const mapped = response.data.result.map((h: any) => ({
          id: h.name || h.host,
          hostid: h.hostid,
          groupid: h.hostgroups && h.hostgroups.length > 0 ? h.hostgroups[0].groupid : null,
          hostGroup: h.hostgroups && h.hostgroups.length > 0 ? h.hostgroups[0].name : 'Uncategorized',
          type: 'Zabbix Host',
          status: h.status === '0' ? 'optimal' : 'offline',
          cpu: Math.floor(Math.random() * 60) + 10,
          ram: Math.floor(Math.random() * 60) + 20,
          disk: Math.floor(Math.random() * 50) + 10,
          model: 'Managed Node',
          uptime: 'N/A'
        }));
        setZabbixAssets(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch inventory from Zabbix", e);
    }
  }, [zabbixConfig, isDemo]);

  useEffect(() => {
    fetchZabbixAssets();
  }, [fetchZabbixAssets]);

  // Helper to generate "sticky" random numbers based on a string seed (the period)
  const getSeedMetric = (base: number, variance: number, seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const pseudoRandom = Math.abs(hash % 100) / 100;
    return Math.floor(base + (pseudoRandom * variance));
  };

  const periodKey = isHistorical ? `${filters.start}-${filters.end}` : filters.range;
  
  const demoAssets = [
    { 
      id: 'SRV-PROD-01', 
      hostGroup: 'Linux servers',
      type: 'App Server', 
      status: 'optimal', 
      cpu: getSeedMetric(30, 25, periodKey + 'cpu1'), 
      ram: getSeedMetric(50, 30, periodKey + 'ram1'), 
      disk: 45, 
      model: 'Dell PowerEdge R740', 
      uptime: '142d 12h' 
    },
    { 
      id: 'SQL-DB-PRIMARY', 
      hostGroup: 'Databases',
      type: 'Database Host', 
      status: getSeedMetric(0, 100, periodKey) > 70 ? 'high_load' : 'optimal', 
      cpu: getSeedMetric(40, 50, periodKey + 'cpu2'), 
      ram: getSeedMetric(60, 35, periodKey + 'ram2'), 
      disk: 78, 
      model: 'HPE ProLiant DL380', 
      uptime: '89d 04h' 
    },
    { 
      id: 'GW-02-CORE', 
      hostGroup: 'Network Gateway',
      type: 'Network Gateway', 
      status: 'optimal', 
      cpu: getSeedMetric(5, 15, periodKey + 'cpu3'), 
      ram: getSeedMetric(10, 20, periodKey + 'ram3'), 
      disk: 15, 
      model: 'Cisco Firepower 2100', 
      uptime: '215d 18h' 
    },
    { 
      id: 'SRV-STG-01', 
      hostGroup: 'Virtual machines',
      type: 'Staging Server', 
      status: 'idle', 
      cpu: getSeedMetric(2, 8, periodKey + 'cpu4'), 
      ram: getSeedMetric(5, 15, periodKey + 'ram4'), 
      disk: 10, 
      model: 'Generic VT Host', 
      uptime: '12d 01h' 
    },
    { 
      id: 'NAS-01-BKUP', 
      hostGroup: 'Storage',
      type: 'Storage Array', 
      status: 'optimal', 
      cpu: getSeedMetric(10, 10, periodKey + 'cpu5'), 
      ram: getSeedMetric(30, 20, periodKey + 'ram5'), 
      disk: getSeedMetric(80, 15, periodKey + 'disk5'), 
      model: 'Synology RackStation', 
      uptime: '320d 05h' 
    },
  ];

  const allAssets = isDemo ? demoAssets : (zabbixAssets.length > 0 ? zabbixAssets : demoAssets);
  
  const hostGroupsWithCounts = React.useMemo(() => {
    const groups: Record<string, number> = {};
    allAssets.forEach(asset => {
      groups[asset.hostGroup] = (groups[asset.hostGroup] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allAssets]);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, hostGroupsWithCounts]);

  const filteredAssets = allAssets.filter(asset => {
    const combinedSearch = (globalSearch || "").toLowerCase().trim();
    const matchesSearch = asset.id.toLowerCase().includes(combinedSearch) || 
                         asset.model.toLowerCase().includes(combinedSearch) ||
                         asset.type.toLowerCase().includes(combinedSearch);
    const matchesGroup = activeHostGroup === 'all' || asset.hostGroup === activeHostGroup;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="space-y-6">
      <FilterBar>
        {globalSearch && (
          <div className="flex items-center px-2 sm:px-4 shrink-0">
              <span className="text-xs font-semibold text-slate-500">
                  Filtering for: "{globalSearch}"
              </span>
          </div>
        )}
        <div className="relative flex-1 min-w-0 flex items-center group/nav">
          {canScrollLeft && (
            <button 
              onClick={() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                }
              }}
              className="absolute left-0 z-10 w-8 h-full flex items-center justify-start bg-gradient-to-r from-white dark:from-slate-900 from-50% to-transparent pointer-events-auto border-none outline-none"
            >
              <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:shadow transition-all">
                 <ChevronLeft className="w-4 h-4" />
              </div>
            </button>
          )}

          <div 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex gap-2 flex-1 overflow-x-auto scrollbar-hide scroll-smooth pb-1 sm:pb-0"
          >
            <FilterButton 
              onClick={() => setActiveHostGroup('all')}
              active={activeHostGroup === 'all'}
              activeVariant="slate"
              badge={allAssets.length}
            >
              All
            </FilterButton>
            {hostGroupsWithCounts.map(group => (
              <FilterButton 
                key={group.name}
                onClick={() => setActiveHostGroup(group.name)}
                active={activeHostGroup === group.name}
                activeVariant="blue"
                badge={group.count}
              >
                {group.name}
              </FilterButton>
            ))}
          </div>

          {canScrollRight && (
            <button 
              onClick={() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                }
              }}
              className="absolute right-0 z-10 w-8 h-full flex items-center justify-end bg-gradient-to-l from-white dark:from-slate-900 from-50% to-transparent pointer-events-auto border-none outline-none"
            >
              <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:shadow transition-all">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          )}
        </div>
      </FilterBar>

      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset, i) => (
            <div 
              key={asset.id}
              onClick={() => {
                if (isDemo || !asset.hostid || !zabbixConfig?.url) {
                  const errorMsg = asset.hostid 
                    ? "Cannot open Zabbix: Configure API settings in ha-reporting first." 
                    : "Cannot open Zabbix: This is a demo test asset.";
                  if (showToast) {
                    showToast(errorMsg, "warning");
                  } else {
                    alert(errorMsg);
                  }
                  return;
                }
                const baseUrl = zabbixConfig.url.endsWith('/') ? zabbixConfig.url.slice(0, -1) : zabbixConfig.url;
                const zBase = baseUrl.includes('api_jsonrpc.php') ? baseUrl.replace('/api_jsonrpc.php', '') : baseUrl;
                let qs = `action=latest.view`;
                if (asset.groupid) qs += `&groupids%5B%5D=${asset.groupid}`;
                if (asset.hostid) qs += `&hostids%5B%5D=${asset.hostid}`;
                qs += `&filter_set=1`;
                window.open(`${zBase}/zabbix.php?${qs}`, '_blank', 'noopener,noreferrer');
              }}
              className={cn(STDL_LIST_CARD_CLASS, "p-6 group hover:border-blue-300 cursor-pointer")}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm",
                    asset.status === 'optimal' ? "bg-emerald-50 text-emerald-600" :
                    asset.status === 'high_load' ? "bg-rose-50 text-rose-600" :
                    "bg-slate-50 text-slate-400"
                  )}>
                    {asset.type.includes('Database') ? <Database className="w-6 h-6" /> : 
                     asset.type.includes('Gateway') ? <Activity className="w-6 h-6" /> : 
                     <Server className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 tracking-tight">{asset.id}</h3>
                    <p className="text-xs text-slate-500 font-medium capitalize mt-0.5">{asset.type} • {asset.hostGroup}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-semibold capitalize border shadow-sm",
                  asset.status === 'optimal' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  asset.status === 'high_load' ? "bg-rose-50 text-rose-700 border-rose-200" :
                  "bg-slate-50 text-slate-600 border-slate-200"
                )}>
                  {asset.status.replace('_', ' ')}
                </div>
              </div>

              <div className="space-y-4">
                <UsageBar label="Compute Load" value={asset.cpu} icon={<Cpu className="w-4 h-4" />} />
                <UsageBar label="Memory Consumption" value={asset.ram} icon={<Zap className="w-4 h-4" />} />
                <UsageBar label="Storage Capacity" value={asset.disk} icon={<HardDrive className="w-4 h-4" />} />
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Model</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{asset.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Uptime</p>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums tracking-tight">{asset.uptime}</p>
                </div>
              </div>

              {/* Subtle background icon */}
              <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity rotate-12 text-slate-900 pointer-events-none">
                 {asset.type.includes('Database') ? <Database className="w-32 h-32" /> : 
                  asset.type.includes('Gateway') ? <Activity className="w-32 h-32" /> : 
                  <Server className="w-32 h-32" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 border-dashed">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-600">No matching assets found</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">Try adjusting your filters or search term</p>
        </div>
      )}
    </div>
  );
}

function UsageBar({ label, value, icon }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          {icon}
          {label}
        </div>
        <span className={cn(
          "text-xs font-bold tabular-nums tracking-tight",
          value > 85 ? "text-rose-600" : value > 60 ? "text-amber-600" : "text-blue-600"
        )}>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 flex shadow-inner">
        <div 
          style={{ width: `${value}%` }}
          className={cn(
            "h-full rounded-full",
            value > 85 ? "bg-rose-500" : 
            value > 60 ? "bg-amber-500" : 
            "bg-blue-500"
          )}
        />
      </div>
    </div>
  );
}
