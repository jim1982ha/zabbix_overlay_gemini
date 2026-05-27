import React, { useState, useRef } from "react";
import { 
  ChevronDown, 
  Search, 
  RefreshCw,
  Shield,
  ShieldAlert,
  Server,
  Activity,
  Info
} from "lucide-react";
import { ScrollableBar } from "../layout/ScrollableBar";
import { PortalMenu } from "./PortalMenu";
import { RangePicker } from "./RangePicker";
import { cn } from "../../lib/utils";
import { useDashboard } from "../../contexts/DashboardContext";

interface TopNavigationBarProps {
  globalSearch: string;
  setGlobalSearch: (val: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  lastSync: Date;
  isDemo: boolean;
  zabbixUrl: string;
  requiresSecureToken: boolean;
  onOpenSecureToken: () => void;
  refreshProgress: number;
}

function MenuOption({ active, onClick, children, activeClass = "text-blue-700 dark:text-sky-400 bg-blue-50/80 dark:bg-sky-500/10" }: { active: boolean, onClick: () => void, children: React.ReactNode, activeClass?: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors block",
        active ? activeClass : "text-slate-600 dark:text-slate-400"
      )}
    >
      {children}
    </button>
  );
}

export function TopNavigationBar({
  globalSearch,
  setGlobalSearch,
  isLoading,
  onRefresh,
  lastSync,
  isDemo,
  zabbixUrl,
  requiresSecureToken,
  onOpenSecureToken,
  refreshProgress
}: TopNavigationBarProps) {
  const { filters, setFilters } = useDashboard();
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showGranMenu, setShowGranMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);

  const rangeMenuBtnRef = useRef<HTMLButtonElement>(null);
  const granMenuBtnRef = useRef<HTMLButtonElement>(null);
  const modeMenuBtnRef = useRef<HTMLButtonElement>(null);

  const formatLastSync = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="flex items-center justify-between w-full h-full text-slate-800 dark:text-slate-200 gap-2 sm:gap-4 lg:gap-8 min-w-0 max-w-full overflow-visible">
      {/* Search Input Filter */}
      <div className="hidden md:flex flex-1 items-center h-[40px] px-3 min-w-0 border-none bg-transparent">
        <Search className="w-5 h-5 text-black dark:text-white shrink-0 mr-2 stroke-[2.2]" />
        <input 
          type="text" 
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search" 
          className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0" 
        />
        <div className="relative group flex items-center shrink-0 ml-2 overflow-visible">
          <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 cursor-help transition-colors hover:text-slate-600 dark:hover:text-slate-300" />
          <div className="absolute right-0 top-full mt-2 w-56 p-2.5 bg-slate-800 dark:bg-slate-700 text-slate-100 text-sm font-medium rounded shadow-xl opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all pointer-events-none z-[9999] whitespace-normal">
            Search across widget titles, hosts, metrics, and tags.
          </div>
        </div>
      </div>

      {/* Main Filter Dropdowns */}
      <div className="shrink-0 flex items-center h-full justify-end select-none">
        <div className="h-full">
          <ScrollableBar>
            <div className="flex flex-nowrap items-center gap-1 sm:gap-4 py-1 h-full pt-1.5 shrink-0 px-6 sm:px-2 md:sm:px-0 min-w-max md:ml-auto justify-end">
              {filters.mode === 'live' ? (
                <>
                  <div className="flex items-center min-w-[120px] h-full shrink-0">
                    <button 
                      ref={rangeMenuBtnRef}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowRangeMenu(!showRangeMenu); }}
                      className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded"
                    >
                      <span className="flex items-center gap-2 w-full truncate">
                        <span className="text-slate-500 font-normal hidden xl:inline shrink-0">Rolling:</span>
                        <span className="font-semibold text-blue-600 dark:text-sky-400 truncate">
                          {filters.range === '1h' ? 'Last Hour' : 
                           filters.range === '6h' ? 'Last 6 Hours' : 
                           filters.range === '24h' ? 'Last 24 Hours' : 'Last 7 Days'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                    </button>
                  </div>
                  <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex items-center min-w-[120px] h-full shrink-0">
                    <button 
                      ref={granMenuBtnRef}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGranMenu(!showGranMenu); }}
                      className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded"
                    >
                      <span className="flex items-center gap-2 w-full truncate">
                        <span className="text-slate-500 font-normal hidden xl:inline shrink-0">Granularity:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-300 truncate">
                          {filters.granularity === '1m' ? '1 Min' :
                           filters.granularity === '5m' ? '5 Min' :
                           filters.granularity === '15m' ? '15 Min' : '1 Hour'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <RangePicker 
                    range={{ start: filters.start, end: filters.end }}
                    onChange={(newVal) => setFilters({...filters, ...newVal})}
                  />
                  <div className="hidden sm:block w-[1px] h-4 bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex items-center min-w-[100px] h-full shrink-0">
                    <button 
                      ref={granMenuBtnRef}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGranMenu(!showGranMenu); }}
                      className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded"
                    >
                      <span className="flex items-center gap-2 w-full truncate">
                        <span className="text-slate-500 font-normal hidden xl:inline shrink-0">Resolution:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-300 truncate">
                          {filters.granularity === '5m' ? '5 Min' :
                           filters.granularity === '30m' ? '30 Min' :
                           filters.granularity === '1d' ? '1 Day' : '1 Hour'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                    </button>
                  </div>
                </>
              )}
              <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 block shrink-0" />
              <div className="flex items-center min-w-[80px] sm:min-w-[100px] h-full shrink-0">
                <button 
                  ref={modeMenuBtnRef}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModeMenu(!showModeMenu); }}
                  className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded relative overflow-hidden"
                >
                  <span className="flex items-center gap-2 relative z-10 w-full h-full justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {filters.mode === 'live' ? 'Live' : 'Historical'}
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                  </span>
                  {filters.mode === 'live' && (
                    <div 
                      className="absolute bottom-0 left-0 h-[3px] bg-blue-600 transition-all duration-1000 ease-linear pointer-events-none rounded-b" 
                      style={{ width: `${refreshProgress}%` }} 
                    />
                  )}
                </button>
              </div>
            </div>
          </ScrollableBar>
        </div>

        {/* Portal Menus */}
        <PortalMenu isOpen={showRangeMenu} onClose={() => setShowRangeMenu(false)} anchorRef={rangeMenuBtnRef}>
          {['1h', '6h', '24h', '7d'].map((r) => (
            <MenuOption 
              key={r}
              active={filters.range === r}
              onClick={() => { setFilters({...filters, range: r}); setShowRangeMenu(false); }}
            >
              {r === '1h' ? 'Last Hour' : r === '6h' ? '6 Hours' : r === '24h' ? '24 Hours' : '7 Days'}
            </MenuOption>
          ))}
        </PortalMenu>

        <PortalMenu isOpen={showGranMenu} onClose={() => setShowGranMenu(false)} anchorRef={granMenuBtnRef}>
          {(filters.mode === 'live' ? ['1m', '5m', '15m', '1h'] : ['5m', '30m', '1h', '1d']).map((g) => (
            <MenuOption 
              key={g}
              active={filters.granularity === g}
              onClick={() => { setFilters({...filters, granularity: g as any}); setShowGranMenu(false); }}
              activeClass="text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/10"
            >
              {g === '1m' ? '1 Minute' : g === '5m' ? '5 Minutes' : g === '15m' ? '15 Minutes' : g === '30m' ? '30 Minutes' : g === '1d' ? '1 Day' : '1 Hour'}
            </MenuOption>
          ))}
        </PortalMenu>

        <PortalMenu isOpen={showModeMenu} onClose={() => setShowModeMenu(false)} anchorRef={modeMenuBtnRef} align="right">
          <MenuOption active={filters.mode === 'live'} onClick={() => { setFilters({...filters, mode: 'live'}); setShowModeMenu(false); }}>
            Live
          </MenuOption>
          <MenuOption active={filters.mode === 'historical'} onClick={() => { setFilters({...filters, mode: 'historical'}); setShowModeMenu(false); }}>
            Historical
          </MenuOption>
        </PortalMenu>
      </div>
    </div>
  );
}
