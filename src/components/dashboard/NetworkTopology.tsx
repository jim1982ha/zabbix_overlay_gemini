import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, Globe, Zap, Shield, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from "../ui/Card";
import { FilterBar, FilterButton } from "../ui/FilterBar";
import axios from 'axios';

export function NetworkTopology({ filters, globalSearch = "", zabbixConfig, isDemo }: { filters: any, globalSearch?: string, zabbixConfig?: { url: string, token: string }, isDemo: boolean }) {
  const isHistorical = filters.mode === 'historical';
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{from: string, to: string} | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [groupingMode, setGroupingMode] = useState<'none' | 'hostGroup' | 'status'>('none');

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
    if (isDemo) return;
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
  }, [zabbixConfig, isDemo]);

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
    // Subtract 32px for Card horizontal padding (p-4 = 16px left + 16px right)
    const width = Math.max(containerWidth - 32, 800);
    
    if (groupingMode === 'none') {
      if (isDemo) {
        return [
          { id: 'gw-01', type: 'gateway', x: width * 0.50, y: 30, status: 'online', label: 'Primary Gateway' },
          { id: 'sw-01', type: 'switch', x: width * 0.35, y: 150, status: 'online', label: 'Core Switch 01' },
          { id: 'sw-02', type: 'switch', x: width * 0.65, y: 150, status: 'online', label: 'Core Switch 02' },
          { id: 'srv-01', type: 'server', x: width * 0.15, y: 300, status: 'online', label: 'App Server 01' },
          { id: 'srv-02', type: 'server', x: width * 0.35, y: 300, status: 'online', label: 'App Server 02' },
          { id: 'srv-03', type: 'server', x: width * 0.55, y: 300, status: 'online', label: 'App Server 03' },
          { id: 'db-01', type: 'server', x: width * 0.75, y: 300, status: 'online', label: 'DB Cluster A' },
          { id: 'db-02', type: 'server', x: width * 0.90, y: 300, status: 'offline', label: 'DB Cluster B (Maint)' },
        ];
      } else {
        const gateway = { id: 'gw-real-01', type: 'gateway', x: width / 2, y: 30, status: 'online', label: 'Zabbix Gateway' };
        const rawHosts = zabbixNodes.filter(n => n.host);
        const nodeSpacing = 160;
        const mapped = rawHosts.map((h, i) => {
          const cols = Math.max(2, Math.floor(width / nodeSpacing));
          const row = Math.floor(i / cols);
          const col = i % cols;
          const itemsInRow = Math.min(cols, rawHosts.length - row * cols);
          const rowWidth = itemsInRow * nodeSpacing;
          const startX = (width - rowWidth) / 2;
          return {
            id: h.host,
            type: 'server',
            x: startX + (col * nodeSpacing) + (nodeSpacing / 2),
            y: 180 + (row * 120),
            status: h.status === '0' ? 'online' : 'offline',
            label: h.name || h.host
          };
        });
        return [gateway, ...mapped];
      }
    }

    // Otherwise, groupingMode is 'status' or 'hostGroup'
    const gateway = isDemo 
      ? { id: 'gw-01', type: 'gateway', x: width * 0.50, y: 30, status: 'online', label: 'Primary Gateway' }
      : { id: 'gw-real-01', type: 'gateway', x: width / 2, y: 30, status: 'online', label: 'Zabbix Gateway' };

    const rawHosts = isDemo 
      ? [
          { host: 'sw-01', type: 'switch', status: '0', name: 'Core Switch 01', hostgroups: [{ name: 'Infrastructure' }] },
          { host: 'sw-02', type: 'switch', status: '0', name: 'Core Switch 02', hostgroups: [{ name: 'Infrastructure' }] },
          { host: 'srv-01', type: 'server', status: '0', name: 'App Server 01', hostgroups: [{ name: 'Applications' }] },
          { host: 'srv-02', type: 'server', status: '0', name: 'App Server 02', hostgroups: [{ name: 'Applications' }] },
          { host: 'srv-03', type: 'server', status: '0', name: 'App Server 03', hostgroups: [{ name: 'Applications' }] },
          { host: 'db-01', type: 'server', status: '0', name: 'DB Cluster A', hostgroups: [{ name: 'Databases' }] },
          { host: 'db-02', type: 'server', status: '1', name: 'DB Cluster B (Maint)', hostgroups: [{ name: 'Databases' }] },
        ]
      : zabbixNodes.filter(n => n.host);

    let groupedData: Record<string, any[]> = {};
    if (groupingMode === 'hostGroup') {
      rawHosts.forEach(h => {
        const groupName = h.hostgroups?.[0]?.name || 'Uncategorized';
        if (!groupedData[groupName]) groupedData[groupName] = [];
        groupedData[groupName].push(h);
      });
    } else { // status
      rawHosts.forEach(h => {
        const statusName = h.status === '0' ? 'Online' : 'Offline';
        if (!groupedData[statusName]) groupedData[statusName] = [];
        groupedData[statusName].push(h);
      });
    }

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
            type: h.type || 'server',
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
  }, [containerWidth, isDemo, zabbixNodes, groupingMode]);

  const layoutLinks = useMemo(() => {
    if (isDemo) {
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
  }, [isDemo, layoutNodes, periodKey]);

  const nodes = layoutNodes;
  const links = layoutLinks;

  return (
    <div className="space-y-6">
      <FilterBar>
        <div className="flex gap-2 flex-1 overflow-x-auto scrollbar-hide scroll-smooth pb-1 sm:pb-0">
          <FilterButton 
            onClick={() => setGroupingMode('none')}
            active={groupingMode === 'none'}
            activeVariant="slate"
          >
            Organic
          </FilterButton>
          <FilterButton 
            onClick={() => setGroupingMode('hostGroup')}
            active={groupingMode === 'hostGroup'}
            activeVariant="slate"
          >
            Host Groups
          </FilterButton>
          <FilterButton 
            onClick={() => setGroupingMode('status')}
            active={groupingMode === 'status'}
            activeVariant="slate"
          >
            Status
          </FilterButton>
        </div>
      </FilterBar>
      <div className="flex flex-col gap-6">
        <div ref={containerRef} className="relative min-h-[450px] overflow-x-auto w-full">
          <Card className="p-4 relative min-h-[450px] shadow-none block rounded-none border-slate-200 w-full">
          {/* SVG Topology Graph */}
          {(() => {
            const maxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) : 300;
            const vbHeight = maxY + 80;
            const vbWidth = Math.max(containerWidth - 32, 800);
            return (
              <svg 
                className="block mx-auto" 
                style={{ width: "100%", minWidth: "800px", height: `${Math.max(450, vbHeight)}px` }} 
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
                      className="fill-none stroke-blue-500/20 stroke-1"
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
          </Card>
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
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-800 dark:border-slate-800 shadow-xl p-3 min-w-[200px] rounded-xl text-slate-900 dark:text-slate-100">
            {hoveredNode && (() => {
              const node = nodes.find(n => n.id === hoveredNode)!;
              return (
                <>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 text-sm">{node.label}</span>
                  </div>
                  <div className="space-y-1.5">
                    {node.type === 'server' && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">CPU Usage:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{getSeedMetric(30, 60, periodKey + node.id + 'cpu')}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">RAM Usage:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{getSeedMetric(40, 50, periodKey + node.id + 'ram')}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Active Connections:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{getSeedMetric(100, 900, periodKey + node.id + 'conn')}</span>
                        </div>
                      </>
                    )}
                    {node.type === 'gateway' && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Packet Loss:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{(getSeedMetric(0, 5, periodKey + node.id + 'pl') / 10).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Throughput:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{getSeedMetric(500, 1500, periodKey + node.id + 'tp')} Mbps</span>
                        </div>
                      </>
                    )}
                    {node.type === 'switch' && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Port Utilization:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{getSeedMetric(20, 40, periodKey + node.id + 'pu')}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Dropped Packets:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{getSeedMetric(0, 100, periodKey + node.id + 'dp')}</span>
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
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Zap className="w-4 h-4 text-sky-500" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Link Metrics</span>
                  </div>
                  <div className="space-y-1.5 flex flex-col items-center">
                     <div className="flex items-center justify-between w-full text-xs text-slate-600 dark:text-slate-300 font-medium mb-1">
                       <span className="truncate max-w-[80px]">{fromNode.label}</span>
                       <ArrowDownRight className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                       <span className="truncate max-w-[80px] text-right">{toNode.label}</span>
                     </div>
                     <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1 relative">
                        <div className={cn("absolute left-0 top-0 bottom-0", load > 80 ? "bg-rose-500" : "bg-sky-500")} style={{ width: `${load}%` }} />
                     </div>
                     <div className="flex justify-between w-full text-xs mt-1">
                        <span className="text-slate-500 dark:text-slate-400">Utilization:</span>
                        <span className={cn("font-semibold", load > 80 ? "text-rose-600 dark:text-rose-400" : "text-sky-600 dark:text-sky-400")}>{load}%</span>
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
