import React from 'react';
import { motion } from 'motion/react';
import { Activity, Globe, Zap, Shield, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export function NetworkTopology({ filters, globalSearch = "" }: { filters: any, globalSearch?: string }) {
  const isHistorical = filters.mode === 'historical';

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
  
  const nodes = [
    { id: 'gw-01', type: 'gateway', x: 50, y: 50, status: 'online', label: 'Primary Gateway' },
    { id: 'sw-01', type: 'switch', x: 35, y: 150, status: 'online', label: 'Core Switch 01' },
    { id: 'sw-02', type: 'switch', x: 65, y: 150, status: 'online', label: 'Core Switch 02' },
    { id: 'srv-01', type: 'server', x: 10, y: 300, status: 'online', label: 'App Server 01' },
    { id: 'srv-02', type: 'server', x: 30, y: 300, status: 'online', label: 'App Server 02' },
    { id: 'srv-03', type: 'server', x: 50, y: 300, status: 'online', label: 'App Server 03' },
    { id: 'db-01', type: 'server', x: 70, y: 300, status: 'online', label: 'DB Cluster A' },
    { id: 'db-02', type: 'server', x: 90, y: 300, status: 'online', label: 'DB Cluster B' },
  ];

  const links = [
    { from: 'gw-01', to: 'sw-01', load: getSeedMetric(10, 60, periodKey + 'l1') },
    { from: 'gw-01', to: 'sw-02', load: getSeedMetric(10, 40, periodKey + 'l2') },
    { from: 'sw-01', to: 'srv-01', load: getSeedMetric(5, 20, periodKey + 'l3') },
    { from: 'sw-01', to: 'srv-02', load: getSeedMetric(5, 20, periodKey + 'l4') },
    { from: 'sw-01', to: 'srv-03', load: getSeedMetric(5, 20, periodKey + 'l5') },
    { from: 'sw-02', to: 'db-01', load: getSeedMetric(15, 30, periodKey + 'l6') },
    { from: 'sw-02', to: 'db-02', load: getSeedMetric(15, 30, periodKey + 'l7') },
  ];

  return (
    <div className="space-y-6">
      {(isHistorical || globalSearch) && (
        <div className={cn(
          "border p-4 rounded-xl flex items-center justify-between mb-2 shadow-sm animate-in fade-in duration-300",
          isHistorical ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"
        )}>
          <div className="flex items-center gap-3">
             <div className={cn(
               "w-8 h-8 rounded-lg flex items-center justify-center",
               isHistorical ? "bg-amber-100/50" : "bg-blue-100/50"
             )}>
                <Search className={cn("w-4 h-4", isHistorical ? "text-amber-600" : "text-blue-600")} />
             </div>
             <div>
                <p className={cn("text-sm font-semibold", isHistorical ? "text-amber-800" : "text-blue-800")}>
                  {isHistorical ? "Historical Topology Snapshot" : `Topology Search Active: "${globalSearch}"`}
                </p>
                <p className={cn("text-xs mt-0.5 font-medium", isHistorical ? "text-amber-700/70" : "text-blue-700/70")}>
                  {isHistorical ? `Reference Period: ${filters.start} to ${filters.end}` : "Matching nodes are highlighted in the mesh"}
                </p>
             </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-8 relative overflow-hidden h-[600px] shadow-sm">
          <div className="absolute top-8 left-8 z-10">
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Visual Topology</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Live Mesh Connectivity</p>
          </div>

          <div className="absolute top-8 right-8 z-10 flex gap-2">
             <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-semibold text-blue-700 flex items-center gap-2 animate-pulse">
                <Globe className="w-3.5 h-3.5" /> External Link Active
             </div>
          </div>

          {/* SVG Topology Graph */}
          <svg className="w-full h-full" viewBox="0 0 100 300">
            <defs>
              <linearGradient id="linkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            
            {/* Links */}
            {links.map((link, i) => {
              const fromNode = nodes.find(n => n.id === link.from)!;
              const toNode = nodes.find(n => n.id === link.to)!;
              const isSearching = globalSearch.length > 0;
              const fromMatch = isSearching && (fromNode.id.toLowerCase().includes(globalSearch.toLowerCase()) || fromNode.label.toLowerCase().includes(globalSearch.toLowerCase()));
              const toMatch = isSearching && (toNode.id.toLowerCase().includes(globalSearch.toLowerCase()) || toNode.label.toLowerCase().includes(globalSearch.toLowerCase()));

              return (
                <g key={`link-${i}`} className={cn("transition-opacity", isSearching && !fromMatch && !toMatch ? "opacity-10" : "opacity-100")}>
                  <line 
                    x1={`${fromNode.x}%`} 
                    y1={fromNode.y} 
                    x2={`${toNode.x}%`} 
                    y2={toNode.y} 
                    stroke={fromMatch || toMatch ? "#0284c7" : "url(#linkGradient)"} 
                    strokeWidth={fromMatch || toMatch ? "1.5" : "1"} 
                  />
                  <motion.circle
                    r={fromMatch || toMatch ? "1" : "0.5"}
                    fill="#0284c7"
                    initial={{ offsetDistance: "0%" }}
                    animate={{ offsetDistance: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: i * 0.5 }}
                  >
                    <animateMotion
                      path={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </motion.circle>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSearching = globalSearch.length > 0;
              const isMatch = isSearching && (node.id.toLowerCase().includes(globalSearch.toLowerCase()) || node.label.toLowerCase().includes(globalSearch.toLowerCase()));

              return (
                <g key={node.id} className={cn("transition-all", isSearching && !isMatch ? "opacity-20 scale-90" : "opacity-100 scale-100")}>
                  <circle 
                    cx={`${node.x}%`} 
                    cy={node.y} 
                    r={isMatch ? "12" : "8"} 
                    className={cn(
                      "fill-white transition-all",
                      isMatch ? "stroke-blue-600 stroke-2" : (node.type === 'gateway' ? "stroke-blue-500" : "stroke-slate-100")
                    )}
                    strokeWidth="1"
                  />
                  {isMatch && (
                    <circle 
                      cx={`${node.x}%`} 
                      cy={node.y} 
                      r="16" 
                      className="fill-none stroke-blue-500/20 stroke-1 animate-ping"
                    />
                  )}
                  <circle 
                    cx={`${node.x}%`} 
                    cy={node.y} 
                    r="2.5" 
                    className={node.status === 'online' ? "fill-emerald-500" : "fill-rose-500"}
                  />
                  <text 
                    x={`${node.x}%`} 
                    y={node.y + (isMatch ? 20 : 15)} 
                    textAnchor="middle" 
                    className={cn(
                      "transition-all string capitalize",
                      isMatch ? "fill-blue-600 text-[10px] font-semibold" : "fill-slate-500 text-[9px] font-medium"
                    )}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>


          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(2,132,199,0.02),transparent)] pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
