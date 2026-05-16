import React from 'react';
import { motion } from 'motion/react';
import { Server, Cpu, HardDrive, Database, Zap, Activity, ChevronRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export function InfraInventory({ filters, globalSearch = "" }: { filters: any, globalSearch?: string }) {
  const isHistorical = filters.mode === 'historical';
  const [activeCluster, setActiveCluster] = React.useState<'all' | 'prod'>('all');
  
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
  
  const allAssets = [
    { 
      id: 'SRV-PROD-01', 
      cluster: 'prod',
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
      cluster: 'prod',
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
      cluster: 'prod',
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
      cluster: 'staging',
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
      cluster: 'prod',
      type: 'Storage Array', 
      status: 'optimal', 
      cpu: getSeedMetric(10, 10, periodKey + 'cpu5'), 
      ram: getSeedMetric(30, 20, periodKey + 'ram5'), 
      disk: getSeedMetric(80, 15, periodKey + 'disk5'), 
      model: 'Synology RackStation', 
      uptime: '320d 05h' 
    },
  ];

  const filteredAssets = allAssets.filter(asset => {
    const combinedSearch = (globalSearch || "").toLowerCase().trim();
    const matchesSearch = asset.id.toLowerCase().includes(combinedSearch) || 
                         asset.model.toLowerCase().includes(combinedSearch) ||
                         asset.type.toLowerCase().includes(combinedSearch);
    const matchesCluster = activeCluster === 'all' || asset.cluster === activeCluster;
    return matchesSearch && matchesCluster;
  });

  return (
    <div className="space-y-6">
      {isHistorical && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-amber-100/50 flex items-center justify-center">
                <Search className="w-4 h-4 text-amber-600" />
             </div>
             <div>
                <p className="text-sm font-semibold text-amber-800 leading-none">Historical Audit Mode</p>
                <p className="text-xs text-amber-700/70 font-medium mt-1">
                  Viewing Hardware State for: {filters.start} to {filters.end}
                </p>
             </div>
          </div>
          <div className="text-[10px] font-semibold text-amber-600/60 uppercase tracking-widest">Data Snapshot</div>
        </div>
      )}
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white border border-slate-200 p-2 rounded-xl shadow-sm">
        <div className="flex-1 flex items-center px-4">
            <span className="text-xs font-semibold text-slate-500">
                {globalSearch ? `Filtering for: "${globalSearch}"` : 'Cluster Inventory Active'}
            </span>
        </div>
        <div className="flex gap-2 shrink-0 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button 
            onClick={() => setActiveCluster('all')}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all rounded-lg",
              activeCluster === 'all' ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            All Clusters
          </button>
          <button 
            onClick={() => setActiveCluster('prod')}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all rounded-lg",
              activeCluster === 'prod' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            Production
          </button>
          <button 
            onClick={() => setActiveCluster('staging' as any)}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-all rounded-lg",
              (activeCluster as string) === 'staging' ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            Staging
          </button>
        </div>
      </div>

      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset, i) => (
            <motion.div 
              key={asset.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white border border-slate-100 rounded-2xl p-6 group hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden shadow-sm hover:shadow-md"
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
                    <p className="text-xs text-slate-500 font-medium capitalize mt-0.5">{asset.type} • {asset.cluster}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-semibold capitalize border shadow-sm",
                  asset.status === 'optimal' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  asset.status === 'high_load' ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" :
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
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Model</p>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">{asset.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Uptime</p>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5 tabular-nums tracking-tight">{asset.uptime}</p>
                </div>
              </div>

              {/* Subtle background icon */}
              <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity rotate-12 text-slate-900 pointer-events-none">
                 {asset.type.includes('Database') ? <Database className="w-32 h-32" /> : 
                  asset.type.includes('Gateway') ? <Activity className="w-32 h-32" /> : 
                  <Server className="w-32 h-32" />}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 border-dashed rounded-2xl">
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
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          {icon}
          {label}
        </div>
        <span className={cn(
          "text-xs font-bold tabular-nums tracking-tight",
          value > 85 ? "text-rose-600" : value > 60 ? "text-amber-600" : "text-blue-600"
        )}>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 flex shadow-inner">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn(
            "h-full rounded-full transition-all duration-500",
            value > 85 ? "bg-rose-500" : 
            value > 60 ? "bg-amber-500" : 
            "bg-blue-500"
          )}
        />
      </div>
    </div>
  );
}
