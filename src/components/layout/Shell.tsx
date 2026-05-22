import { motion } from "motion/react";
import { 
  Settings, 
  Activity, 
  LayoutDashboard, 
  Server,
  ChevronRight,
  ChevronLeft,
  Menu,
  Plus,
  Bell,
  Search,
  X,
  Trash2,
  Moon,
  Sun,
  Waypoints
} from "lucide-react";
import React, { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ShellProps {
  children: ReactNode;
  topBar?: ReactNode;
  savedDashboards: { id: string, name: string }[];
  onSelectDashboard: (id: string) => void;
  onRenameDashboard: (id: string, name: string) => void;
  onAddDashboard: () => void;
  onDeleteDashboard: (id: string, e: React.MouseEvent) => void;
  activeDashboardId?: string;
  onNavigate: (view: string) => void;
  currentView: string;
  lastSync: Date;
  isDesignerMode?: boolean;
  isDemo?: boolean;
  hiddenSeries?: Set<string>;
  toggleSeriesVisibility?: (key: string | string[]) => void;
}

export function Shell({ 
  children, 
  topBar,
  savedDashboards, 
  onSelectDashboard, 
  onRenameDashboard,
  onAddDashboard,
  onDeleteDashboard, 
  activeDashboardId, 
  onNavigate, 
  currentView, 
  lastSync,
  isDesignerMode = false,
  isDemo = true,
  hiddenSeries,
  toggleSeriesVisibility
}: ShellProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    // Default to light. If local storage is set, respect it.
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';
    setTheme(isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden relative">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-md font-bold text-white cursor-pointer" onClick={() => { onNavigate('dashboard'); closeMobileMenu(); }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white cursor-pointer truncate" onClick={() => { onNavigate('dashboard'); closeMobileMenu(); }}>HA Reporting</span>
        </div>
        <button 
          onClick={toggleMobileMenu}
          className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] transition-opacity animate-in fade-in"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-[60] transform transition-all duration-300 shadow-[2px_0_10px_rgba(0,0,0,0.02)]",
        isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "lg:w-[60px]" : "lg:w-56"
      )}>
        <div className={cn(
          "h-[60px] hidden lg:flex items-center text-white bg-blue-600 dark:bg-blue-700 shrink-0 transition-all shadow-sm z-30",
          isCollapsed ? "px-0 justify-center" : "px-4 justify-between"
        )}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2 font-bold cursor-pointer transition-all shrink-0" onClick={() => onNavigate('dashboard')}>
              <div className="w-8 h-8 rounded-none flex items-center justify-center shrink-0 text-white">
                <Activity className="w-6 h-6" />
              </div>
              <span className="font-bold text-base tracking-tight truncate">HA Reporting</span>
            </div>
          ) : null}
          <button onClick={toggleCollapse} className={cn("hidden lg:flex transition-colors", isCollapsed ? "w-[60px] h-[60px] items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-800" : "p-1.5 text-blue-100 hover:bg-blue-700 dark:hover:bg-blue-800 hover:text-white rounded-none")} title={isCollapsed ? "Expand Menu" : "Collapse Menu"}>
            {isCollapsed ? (
              <div className="w-8 h-8 rounded-none flex items-center justify-center shrink-0 text-white cursor-pointer transition-colors">
                <Activity className="w-6 h-6" />
              </div>
            ) : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <div className="lg:hidden p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 h-14 shrink-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu</span>
          <button onClick={closeMobileMenu} className="p-1 hover:bg-slate-200 rounded text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 flex flex-col py-4 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {!isCollapsed && (
            <div className="pb-2 px-4 flex items-center justify-between group/title">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dashboards</span>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddDashboard();
                }}
                className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-blue-600 rounded-md transition-colors"
                title="Add Dashboard"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          
          {savedDashboards.map(db => (
            <div key={db.id} className="relative group">
              <NavItem 
                icon={<LayoutDashboard className="w-4 h-4" />} 
                label={db.name} 
                active={currentView === 'dashboard' && activeDashboardId === db.id}
                isCollapsed={isCollapsed}
                onClick={() => { 
                  onSelectDashboard(db.id); 
                  onNavigate('dashboard');
                  closeMobileMenu();
                }}
              />
              {!isCollapsed && (
                <div className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all z-30",
                  deletingId === db.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  {deletingId === db.id ? (
                    <div className="flex items-center gap-1 bg-white border border-rose-200 rounded shadow-md p-1 right-0 absolute mr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDashboard(db.id, e);
                          setDeletingId(null);
                        }}
                        className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-medium rounded hover:bg-rose-700 transition"
                      >
                       Delete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(null);
                        }}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded hover:bg-slate-200 transition"
                      >
                       Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      title="Delete Dashboard"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingId(db.id);
                      }}
                      className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all bg-white border border-transparent"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {!isCollapsed && (
            <div className="pt-6 pb-2 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Observability
            </div>
          )}
          <NavItem icon={<Server className="w-4 h-4" />} label="Asset Inventory" active={currentView === 'infra'} isCollapsed={isCollapsed} onClick={() => { onNavigate('infra'); closeMobileMenu(); }} />
          <NavItem icon={<Waypoints className="w-4 h-4" />} label="Network Topology" active={currentView === 'network'} isCollapsed={isCollapsed} onClick={() => { onNavigate('network'); closeMobileMenu(); }} />
          <NavItem icon={<Bell className="w-4 h-4" />} label="Current Problems" active={currentView === 'notifications'} isCollapsed={isCollapsed} onClick={() => { onNavigate('notifications'); closeMobileMenu(); }} />

            {/* Active Filters Context Box */}
          {hiddenSeries && hiddenSeries.size > 0 && (
            <div className={cn("px-4 py-4 mt-auto transition-all duration-300", isCollapsed && "px-2 items-center flex flex-col")}>
              {!isCollapsed ? (
                <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3 relative overflow-hidden shadow-sm animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-[10px] uppercase tracking-wider">
                      <Activity className="w-3 h-3" /> 
                      Filters
                    </div>
                    <button 
                      onClick={() => toggleSeriesVisibility?.(Array.from(hiddenSeries))}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100/50 hover:bg-amber-200 text-amber-700 transition-colors"
                    >
                      CLEAR
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(hiddenSeries).map(key => {
                      let displayKey = String(key);
                      if (key === 'agg_val') {
                        displayKey = 'Aggregate Value';
                      } else if (key.endsWith('_agg')) {
                        const parts = key.split('_');
                        if (parts.length >= 3) {
                          displayKey = `${parts[1].toUpperCase()} Auth/Mixed`;
                        } else {
                          displayKey = `${parts[0].toUpperCase()} Aggregated`;
                        }
                      } else {
                        const idx = key.indexOf('_');
                        if (idx !== -1 && !key.startsWith('series')) {
                          const m = key.substring(0, idx);
                          const h = key.substring(idx + 1);
                          displayKey = `${m.toUpperCase()} [${h === 'all' ? 'All' : h}]`;
                        } else if (key.startsWith('series')) {
                           const parts = key.split('_');
                           if (parts.length >= 3) {
                              displayKey = `${parts[1].toUpperCase()} [${parts.slice(2).join('_').replace('all', 'All')}]`;
                           } else {
                              displayKey = key.toUpperCase();
                           }
                        } else {
                          displayKey = key.toUpperCase();
                        }
                      }

                      return (
                        <div key={key} className="flex items-center gap-1 bg-white border border-amber-200 text-slate-600 text-[10px] pl-1.5 pr-0.5 py-0.5 rounded shadow-sm group">
                          <span className="truncate max-w-[120px] font-medium">{displayKey}</span>
                          <button 
                            onClick={() => toggleSeriesVisibility?.(key)}
                            className="hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-sm p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                 <div 
                   className="w-8 h-8 rounded-md bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 relative cursor-pointer hover:bg-amber-200 transition-colors" 
                   title={`${hiddenSeries.size} series hidden. Click to clear filters.`}
                   onClick={() => toggleSeriesVisibility?.(Array.from(hiddenSeries))}
                 >
                   <Activity className="w-5 h-5 flex-shrink-0" />
                   <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full border border-white shadow-sm">
                     {hiddenSeries.size}
                   </span>
                 </div>
              )}
            </div>
          )}
        </nav>
        
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 py-2">
          <NavItem 
            icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} 
            label={theme === 'dark' ? 'Dark Mode' : 'Light Mode'} 
            active={false} 
            isCollapsed={isCollapsed} 
            onClick={toggleTheme} 
          />
          <NavItem 
            icon={
              <span className="relative flex h-2 w-2 m-1">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isDemo ? "bg-amber-400" : "bg-emerald-400")}></span>
                <span className={cn("relative inline-flex rounded-full h-2 w-2 z-10", isDemo ? "bg-amber-500" : "bg-emerald-500")}></span>
              </span>
            } 
            label={
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Node</span>
                {isDemo ? (
                  <div className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-bold text-amber-700 uppercase tracking-wider shadow-sm dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400">
                    Demo
                  </div>
                ) : (
                  <div className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[9px] font-bold text-emerald-700 uppercase tracking-wider shadow-sm dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                    Live
                  </div>
                )}
              </div>
            }
            active={currentView === 'config'}
            isCollapsed={isCollapsed}
            onClick={() => { onNavigate('config'); closeMobileMenu(); }}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden pt-14 lg:pt-0 bg-[#f7f8f9] dark:bg-slate-950 h-screen w-full lg:w-auto">
        {topBar && (
          <div className="flex min-h-[60px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 w-full items-center z-50 overflow-hidden shadow-sm lg:shadow-none relative">
            <div className="flex-1 h-full flex items-center justify-between px-2 lg:px-4 min-w-0 max-w-full overflow-hidden">
               {topBar}
             </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-8 py-4 md:py-6 custom-scrollbar w-full relative">
          <div className="max-w-full lg:max-w-none w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, isCollapsed = false, onClick, className }: { icon: ReactNode, label: string | ReactNode, active?: boolean, isCollapsed?: boolean, onClick?: () => void, className?: string }) {
  return (
    <div 
      onClick={onClick}
      title={isCollapsed && typeof label === 'string' ? label : undefined}
      className={cn(
        "flex items-center transition-all group cursor-pointer",
        isCollapsed ? "justify-center mx-auto w-10 h-10 rounded-md my-0.5" : "px-4 py-3 border-l-[3px]",
        active ? 
          (isCollapsed ? 'bg-[#f0f4f9] dark:bg-blue-500/10 text-[#0055d4] dark:text-blue-400 shadow-sm' : 'bg-[#f0f4f9] dark:bg-blue-500/10 text-[#0055d4] dark:text-blue-400 border-[#0055d4] dark:border-blue-500') : 
          (isCollapsed ? 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border-transparent' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 border-transparent'),
        className
      )}>
      {!isCollapsed && (
        <div className={cn("flex-1 truncate text-[14px] flex items-center", active ? "font-semibold text-slate-900 dark:text-blue-400" : "")}>
          {label}
        </div>
      )}
      <div className={cn(
        "transition-colors shrink-0 flex items-center justify-center",
        active ? "text-[#0055d4] dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 stroke-[1.5]",
        !isCollapsed && "ml-auto"
      )}>
        {icon}
      </div>
    </div>
  );
}

