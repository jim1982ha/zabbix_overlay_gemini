import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Activity, Globe, Zap, Shield, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import axios from 'axios';

export function NetworkTopology({ filters, globalSearch = "", zabbixConfig }: { filters: any, globalSearch?: string, zabbixConfig?: { url: string, token: string } }) {
  const isHistorical = filters.mode === 'historical';
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{from: string, to: string} | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [groupingMode, setGroupingMode] = useState<'none' | 'hostGroup' | 'status'>('none');

  const isSimulated = !zabbixConfig?.url || !zabbixConfig?.token;
  const [zabbixNodes, setZabbixNodes] = useState<any[]>([]);
  const [zabbixLinks, setZabbixLinks] = useState<any[]>([]);

  const [containerWidth, setContainerWidth] = useState(1000);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fetchZabbixTopology = useCallback(async () => {
    if (isSimulated) return;
    try {
      const response = await axios.post("/api/zabbix", {
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        method: "host.get",
        params: {
          output: ["host", "name", "status"],
          selectHostGroups: ["name"]
        }
      });
      if (response.data.result) {
        const hosts = response.data.result;
        
        // Let's postpone generating nodes until render so they depend on containerWidth
        setZabbixNodes(hosts); // just store raw hosts
        // To be safe we'll keep Gateway here or generate it later
       }
    } catch (e) {
      console.error("Failed to fetch topology from Zabbix", e);
    }
  }, [zabbixConfig, isSimulated]);

  useEffect(() => {
    fetchZabbixTopology();
  }, [fetchZabbixTopology]);

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
  
  const layoutNodes = useMemo(() => {
    const width = Math.max(containerWidth, 800);
    
    if (isSimulated) {
      // Basic grouping for simulation if status grouping is selected
      if (groupingMode === 'status') {
        const gateway = { id: 'gw-01', type: 'gateway', x: width * 0.50, y: 30, status: 'online', label: 'Primary Gateway' };
        const onlineHosts = [
          { id: 'sw-01', type: 'switch', status: 'online', label: 'Core Switch 01' },
          { id: 'sw-02', type: 'switch', status: 'online', label: 'Core Switch 02' },
          { id: 'srv-01', type: 'server', status: 'online', label: 'App Server 01' },
          { id: 'srv-02', type: 'server', status: 'online', label: 'App Server 02' },
          { id: 'srv-03', type: 'server', status: 'online', label: 'App Server 03' },
          { id: 'db-01', type: 'server', status: 'online', label: 'DB Cluster A' },
        ];
        const offlineHosts = [
          { id: 'db-02', type: 'server', status: 'offline', label: 'DB Cluster B (Maint)' },
        ];

        const nodeSpacing = 160;
        const rowSpacing = 120;
        
        const mappedOnline = onlineHosts.map((h, i) => {
          const cols = Math.floor(width / nodeSpacing);
          const row = Math.floor(i / cols);
          const col = i % cols;
          return { ...h, x: (col * nodeSpacing) + (nodeSpacing), y: 180 + (row * rowSpacing) };
        });

        const mappedOffline = offlineHosts.map((h, i) => {
          return { ...h, x: width - 150, y: 180 + (i * rowSpacing) };
        });

        return [gateway, ...mappedOnline, ...mappedOffline];
      }

      return [
        { id: 'gw-01', type: 'gateway', x: width * 0.50, y: 30, status: 'online', label: 'Primary Gateway' },
        { id: 'sw-01', type: 'switch', x: width * 0.35, y: 150, status: 'online', label: 'Core Switch 01' },
        { id: 'sw-02', type: 'switch', x: width * 0.65, y: 150, status: 'online', label: 'Core Switch 02' },
        { id: 'srv-01', type: 'server', x: width * 0.15, y: 300, status: 'online', label: 'App Server 01' },
        { id: 'srv-02', type: 'server', x: width * 0.35, y: 300, status: 'online', label: 'App Server 02' },
        { id: 'srv-03', type: 'server', x: width * 0.55, y: 300, status: 'online', label: 'App Server 03' },
        { id: 'db-01', type: 'server', x: width * 0.75, y: 300, status: 'online', label: 'DB Cluster A' },
        { id: 'db-02', type: 'server', x: width * 0.90, y: 300, status: 'online', label: 'DB Cluster B' },
      ];
    } else {
      const gateway = { id: 'gw-real-01', type: 'gateway', x: width / 2, y: 30, status: 'online', label: 'Zabbix Gateway' };
      const rawHosts = zabbixNodes.filter(n => n.host);
      
      let groupedData: Record<string, any[]> = {};
      if (groupingMode === 'hostGroup') {
        rawHosts.forEach(h => {
          const groupName = h.hostgroups?.[0]?.name || 'Uncategorized';
          if (!groupedData[groupName]) groupedData[groupName] = [];
          groupedData[groupName].push(h);
        });
      } else if (groupingMode === 'status') {
        rawHosts.forEach(h => {
          const statusName = h.status === '0' ? 'Online' : 'Offline';
          if (!groupedData[statusName]) groupedData[statusName] = [];
          groupedData[statusName].push(h);
        });
      } else {
        groupedData['all'] = rawHosts;
      }

      // Rebuilding grouping logic slightly more cleanly
      const finalGroups = Object.entries(groupedData);
      const nodeSpacing = 160;
      const rowSpacing = 120;
      const groupSpacing = 100;
      let currentY = 180;
      
      const generatedNodes: any[] = [];
      
      finalGroups.forEach(([groupName, groupHosts]) => {
        const cols = Math.max(2, Math.floor(width / nodeSpacing));
        groupHosts.forEach((h: any, i: number) => {
           const row = Math.floor(i / cols);
           const col = i % cols;
           const itemsInRow = Math.min(cols, groupHosts.length - row * cols);
           const rowWidth = itemsInRow * nodeSpacing;
           const startX = (width - rowWidth) / 2;
           
           generatedNodes.push({
              id: h.host,
              type: 'server',
              x: startX + (col * nodeSpacing) + (nodeSpacing / 2),
              y: currentY + (row * rowSpacing),
              status: h.status === '0' ? 'online' : 'offline',
              label: h.name || h.host,
              group: groupName
           });
        });
        
        const groupRows = Math.ceil(groupHosts.length / cols);
        currentY += (groupRows * rowSpacing) + groupSpacing;
      });

      return [gateway, ...generatedNodes];
    }
  }, [containerWidth, isSimulated, zabbixNodes, groupingMode]);

  const layoutLinks = useMemo(() => {
    if (isSimulated) {
      return [
        { from: 'gw-01', to: 'sw-01', load: getSeedMetric(10, 60, periodKey + 'l1') },
        { from: 'gw-01', to: 'sw-02', load: getSeedMetric(10, 40, periodKey + 'l2') },
        { from: 'sw-01', to: 'srv-01', load: getSeedMetric(5, 20, periodKey + 'l3') },
        { from: 'sw-01', to: 'srv-02', load: getSeedMetric(5, 20, periodKey + 'l4') },
        { from: 'sw-01', to: 'srv-03', load: getSeedMetric(5, 20, periodKey + 'l5') },
        { from: 'sw-02', to: 'db-01', load: getSeedMetric(15, 30, periodKey + 'l6') },
        { from: 'sw-02', to: 'db-02', load: getSeedMetric(15, 30, periodKey + 'l7') },
      ];
    } else {
      const generatedNodes = layoutNodes.filter(n => n.type !== 'gateway');
      return generatedNodes.map((n: any) => ({
         from: 'gw-real-01',
         to: n.id,
         load: Math.floor(Math.random() * 40) + 10 // pseudo random load
      }));
    }
  }, [isSimulated, layoutNodes, periodKey]);

  const nodes = layoutNodes;
  const links = layoutLinks;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setGroupingMode('none')}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              groupingMode === 'none' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Organic
          </button>
          <button 
            onClick={() => setGroupingMode('hostGroup')}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              groupingMode === 'hostGroup' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Host Groups
          </button>
          <button 
            onClick={() => setGroupingMode('status')}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              groupingMode === 'status' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Status
          </button>
        </div>
        
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
      </div>
      <div className="flex flex-col gap-6">
        <div ref={containerRef} className="bg-white border border-slate-100 rounded-2xl p-4 relative overflow-auto h-[450px] shadow-sm custom-scrollbar block">
          {/* SVG Topology Graph */}
          {(() => {
            const maxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) : 300;
            const vbHeight = maxY + 80;
            const vbWidth = Math.max(containerWidth, 800);
            return (
              <svg 
                className="block" 
                style={{ minWidth: `${vbWidth}px`, height: `${Math.max(450, vbHeight)}px` }} 
                viewBox={`0 0 ${vbWidth} ${Math.max(450, vbHeight)}`} 
                preserveAspectRatio="xMidYMin meet"
              >
            <defs>
              <linearGradient id="linkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            
            {/* Group Labels */}
            {groupingMode !== 'none' && (() => {
              const groupsSeen = new Set();
              return nodes.filter(n => n.group).map(n => {
                if (groupsSeen.has(n.group)) return null;
                groupsSeen.add(n.group);
                return (
                  <text 
                    key={`label-${n.group}`}
                    x={20} 
                    y={n.y - 40} 
                    className="fill-slate-400 text-[10px] font-bold uppercase tracking-widest pointer-events-none"
                  >
                    {n.group}
                  </text>
                );
              });
            })()}

            {/* Links */}
            {links.map((link, i) => {
              const fromNode = nodes.find(n => n.id === link.from)!;
              const toNode = nodes.find(n => n.id === link.to)!;
              const isSearching = globalSearch.length > 0;
              const fromMatch = isSearching && (fromNode.id.toLowerCase().includes(globalSearch.toLowerCase()) || fromNode.label.toLowerCase().includes(globalSearch.toLowerCase()));
              const toMatch = isSearching && (toNode.id.toLowerCase().includes(globalSearch.toLowerCase()) || toNode.label.toLowerCase().includes(globalSearch.toLowerCase()));
              const searchFocus = fromMatch || toMatch;
              
              const isLinkHovered = hoveredLink?.from === link.from && hoveredLink?.to === link.to;
              const isNodeHovered = hoveredNode === fromNode.id || hoveredNode === toNode.id;
              const isHighlighted = isLinkHovered || isNodeHovered || searchFocus;
              
              const shouldDim = (hoveredNode || hoveredLink) && !isHighlighted;

              return (
                <g 
                  key={`link-${i}`} 
                  className={cn("transition-opacity cursor-pointer", isSearching && !searchFocus ? "opacity-10" : (shouldDim ? "opacity-20" : "opacity-100"))}
                  onMouseEnter={(e) => {
                    setHoveredLink(link);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredLink(null)}
                >
                  <line 
                    x1={fromNode.x} 
                    y1={fromNode.y} 
                    x2={toNode.x} 
                    y2={toNode.y} 
                    stroke={isHighlighted ? "#0284c7" : "url(#linkGradient)"} 
                    strokeWidth={isHighlighted ? "2" : "1"} 
                  />
                  {/* Invisible wider line for easier hover targeting */}
                  <line 
                    x1={fromNode.x} 
                    y1={fromNode.y} 
                    x2={toNode.x} 
                    y2={toNode.y} 
                    stroke="transparent" 
                    strokeWidth="15" 
                  />
                  <motion.circle
                    r={isHighlighted ? "2" : "1"}
                    fill={isHighlighted ? (link.load > 80 ? "#ef4444" : "#0284c7") : "#0284c7"}
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
              
              const isNodeHovered = hoveredNode === node.id;
              const isConnectedToHoveredLink = hoveredLink?.from === node.id || hoveredLink?.to === node.id;
              const isConnectedToHoveredNode = hoveredNode && links.some(l => (l.from === hoveredNode && l.to === node.id) || (l.to === hoveredNode && l.from === node.id));
              
              const isHighlighted = isNodeHovered || isConnectedToHoveredLink || isConnectedToHoveredNode || isMatch;
              const shouldDim = (hoveredNode || hoveredLink) && !isHighlighted;

              return (
                <g 
                  key={node.id} 
                  className={cn("transition-all cursor-pointer", isSearching && !isMatch ? "opacity-20 scale-90" : (shouldDim ? "opacity-30 scale-95" : "opacity-100 scale-100"))}
                  onMouseEnter={(e) => {
                    setHoveredNode(node.id);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                >
                  <circle 
                    cx={node.x} 
                    cy={node.y} 
                    r={isHighlighted ? "14" : "10"} 
                    className={cn(
                      "fill-white transition-all",
                      isHighlighted ? "stroke-blue-600 stroke-2" : (node.type === 'gateway' ? "stroke-blue-500 stroke-2" : "stroke-slate-200 stroke-1")
                    )}
                  />
                  {/* Invisible wider circle for easier hover targeting */}
                  <circle 
                    cx={node.x} 
                    cy={node.y} 
                    r="24" 
                    fill="transparent"
                  />
                  {isHighlighted && (
                    <circle 
                      cx={node.x} 
                      cy={node.y} 
                      r="18" 
                      className="fill-none stroke-blue-500/20 stroke-1 animate-ping"
                    />
                  )}
                  <circle 
                    cx={node.x} 
                    cy={node.y} 
                    r="3.5" 
                    className={node.status === 'online' ? "fill-emerald-500" : "fill-rose-500"}
                  />
                  <text 
                    x={node.x} 
                    y={node.y + (isHighlighted ? 24 : 20)} 
                    textAnchor="middle" 
                    className={cn(
                      "transition-all string capitalize pointer-events-none",
                      isHighlighted ? "fill-blue-700 text-[11px] font-bold" : "fill-slate-600 text-[10px] font-medium"
                    )}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
            );
          })()}


          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(2,132,199,0.02),transparent)] pointer-events-none" />
        </div>
      </div>
      
      {/* Tooltip Overlay */}
      {(hoveredNode || hoveredLink) && (
        <div 
          className="fixed z-[100] pointer-events-none transition-opacity duration-200"
          style={{ 
            left: Math.min(tooltipPos.x + 15, window.innerWidth - 250), 
            top: Math.min(tooltipPos.y + 15, window.innerHeight - 150) 
          }}
        >
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl rounded-xl p-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
            {hoveredNode && (() => {
              const node = nodes.find(n => n.id === hoveredNode)!;
              return (
                <>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-800 text-sm">{node.label}</span>
                  </div>
                  <div className="space-y-1.5">
                    {node.type === 'server' && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">CPU Usage:</span>
                          <span className="font-medium text-slate-700">{getSeedMetric(30, 60, periodKey + node.id + 'cpu')}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">RAM Usage:</span>
                          <span className="font-medium text-slate-700">{getSeedMetric(40, 50, periodKey + node.id + 'ram')}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Active Connections:</span>
                          <span className="font-medium text-slate-700">{getSeedMetric(100, 900, periodKey + node.id + 'conn')}</span>
                        </div>
                      </>
                    )}
                    {node.type === 'gateway' && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Packet Loss:</span>
                          <span className="font-medium text-slate-700">{(getSeedMetric(0, 5, periodKey + node.id + 'pl') / 10).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Throughput:</span>
                          <span className="font-medium text-slate-700">{getSeedMetric(500, 1500, periodKey + node.id + 'tp')} Mbps</span>
                        </div>
                      </>
                    )}
                    {node.type === 'switch' && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Port Utilization:</span>
                          <span className="font-medium text-slate-700">{getSeedMetric(20, 40, periodKey + node.id + 'pu')}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Dropped Packets:</span>
                          <span className="font-medium text-slate-700">{getSeedMetric(0, 100, periodKey + node.id + 'dp')}</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
            {hoveredLink && (() => {
              const link = hoveredLink;
              const fromNode = nodes.find(n => n.id === link.from)!;
              const toNode = nodes.find(n => n.id === link.to)!;
              // We need the load from the array. Since hoveredLink represents the original link object logic... 
              // Wait, hoveredLink is stored as link obj, so we can access `.load`
              const actualLink = links.find(l => l.from === link.from && l.to === link.to);
              const load = actualLink ? actualLink.load : 0;
              return (
                <>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <Zap className="w-4 h-4 text-sky-500" />
                    <span className="font-semibold text-slate-800 text-sm">Link Metrics</span>
                  </div>
                  <div className="space-y-1.5 flex flex-col items-center">
                     <div className="flex items-center justify-between w-full text-xs text-slate-600 font-medium mb-1">
                       <span className="truncate max-w-[80px]">{fromNode.label}</span>
                       <ArrowDownRight className="w-3 h-3 text-slate-400 shrink-0" />
                       <span className="truncate max-w-[80px] text-right">{toNode.label}</span>
                     </div>
                     <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1 relative">
                        <div className={cn("absolute left-0 top-0 bottom-0", load > 80 ? "bg-rose-500" : "bg-sky-500")} style={{ width: `${load}%` }} />
                     </div>
                     <div className="flex justify-between w-full text-xs mt-1">
                        <span className="text-slate-500">Utilization:</span>
                        <span className={cn("font-semibold", load > 80 ? "text-rose-600" : "text-sky-600")}>{load}%</span>
                     </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
