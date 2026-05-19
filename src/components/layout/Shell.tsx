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
  Sun
} from "lucide-react";
import React, { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ShellProps {
  children: ReactNode;
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
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-md font-bold text-white cursor-pointer" onClick={() => { onNavigate('dashboard'); closeMobileMenu(); }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 cursor-pointer truncate" onClick={() => { onNavigate('dashboard'); closeMobileMenu(); }}>HA Reporting</span>
        </div>
        <button 
          onClick={toggleMobileMenu}
          className="p-1 text-slate-500 hover:bg-slate-50 rounded transition-colors"
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
        "fixed lg:relative inset-y-0 left-0 bg-white border-r border-slate-200 flex flex-col z-[60] transform transition-all duration-300 shadow-[2px_0_10px_rgba(0,0,0,0.02)]",
        isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "lg:w-[60px]" : "lg:w-56"
      )}>
        <div className={cn(
          "h-[60px] hidden lg:flex items-center bg-white text-slate-900 border-b border-slate-200 shadow-sm shrink-0 transition-all",
          isCollapsed ? "px-0 justify-center" : "px-4 justify-between"
        )}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2 font-bold cursor-pointer transition-all shrink-0" onClick={() => onNavigate('dashboard')}>
              <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-sm shrink-0 text-white">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-bold text-base tracking-tight truncate">HA Reporting</span>
            </div>
          ) : null}
          <button onClick={toggleCollapse} className={cn("hidden lg:flex transition-colors", isCollapsed ? "w-[60px] h-[60px] items-center justify-center hover:bg-slate-50" : "p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-md")} title={isCollapsed ? "Expand Menu" : "Collapse Menu"}>
            {isCollapsed ? (
              <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-sm shrink-0 text-white cursor-pointer hover:bg-blue-700 transition-colors">
                <Activity className="w-5 h-5" />
              </div>
            ) : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="lg:hidden p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 h-14 shrink-0">
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
          <NavItem icon={<Bell className="w-4 h-4" />} label="Current Problems" active={currentView === 'notifications'} isCollapsed={isCollapsed} onClick={() => { onNavigate('notifications'); closeMobileMenu(); }} />
          <NavItem icon={<Activity className="w-4 h-4" />} label="Network Topology" active={currentView === 'network'} isCollapsed={isCollapsed} onClick={() => { onNavigate('network'); closeMobileMenu(); }} />

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
                      const m = key.split('_')[0];
                      const h = key.substring(m.length + 1);
                      const displayKey = `${m.toUpperCase()} [${h === 'all' ? 'All' : h}]`;
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
        
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/50 py-2">
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
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Node</span>
                {isDemo ? (
                  <div className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-bold text-amber-700 uppercase tracking-wider shadow-sm">
                    Demo
                  </div>
                ) : (
                  <div className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[9px] font-bold text-emerald-700 uppercase tracking-wider shadow-sm">
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
      <main className="flex-1 flex flex-col relative overflow-hidden pt-14 lg:pt-0 bg-slate-50 h-screen w-full lg:w-auto">
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
        isCollapsed ? "justify-center mx-auto w-8 h-8 rounded-md" : "gap-3 px-4 py-2 border-l-[3px]",
        active ? 
          (isCollapsed ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100/50' : 'bg-blue-50/50 text-blue-700 border-blue-600') : 
          (isCollapsed ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-transparent' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'),
        className
      )}>
      <div className={cn(
        "transition-colors shrink-0",
        active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
      )}>
        {icon}
      </div>
      {!isCollapsed && (
        <>
          <span className={cn("flex-1 truncate text-sm font-medium", active ? "font-semibold" : "")}>{label}</span>
          {active && <ChevronRight className="w-3.5 h-3.5 opacity-30 ml-auto shrink-0" />}
        </>
      )}
    </div>
  );
}

