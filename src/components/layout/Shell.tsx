import { motion } from "motion/react";
import { 
  BarChart3, 
  Settings, 
  Activity, 
  AlertCircle, 
  LayoutDashboard, 
  Server,
  ChevronRight,
  ChevronLeft,
  Menu,
  Plus,
  Bell,
  Search,
  Zap,
  X,
  Trash2
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
  isSimulated?: boolean;
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
  isSimulated = true
}: ShellProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

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
        isCollapsed ? "lg:w-16" : "lg:w-56"
      )}>
        <div className={cn(
          "h-14 hidden lg:flex items-center bg-white text-slate-900 border-b border-slate-200 shadow-sm shrink-0 transition-all",
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
          <button onClick={toggleCollapse} className="hidden lg:flex p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-md transition-colors" title={isCollapsed ? "Expand Menu" : "Collapse Menu"}>
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

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
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
          <NavItem icon={<Activity className="w-4 h-4" />} label="Network Topology" active={currentView === 'network'} isCollapsed={isCollapsed} onClick={() => { onNavigate('network'); closeMobileMenu(); }} />
          <NavItem icon={<Server className="w-4 h-4" />} label="Asset Inventory" active={currentView === 'infra'} isCollapsed={isCollapsed} onClick={() => { onNavigate('infra'); closeMobileMenu(); }} />
          <NavItem icon={<Zap className="w-4 h-4" />} label="Application Events" active={currentView === 'events'} isCollapsed={isCollapsed} onClick={() => { onNavigate('events'); closeMobileMenu(); }} />
          
          {!isCollapsed && (
            <div className="pt-6 pb-2 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Settings
            </div>
          )}
          <NavItem icon={<Bell className="w-4 h-4" />} label="Alert Rules" active={currentView === 'notifications'} isCollapsed={isCollapsed} onClick={() => { onNavigate('notifications'); closeMobileMenu(); }} />
          <NavItem icon={<Settings className="w-4 h-4" />} label="Zabbix API Settings" active={currentView === 'config'} isCollapsed={isCollapsed} onClick={() => { onNavigate('config'); closeMobileMenu(); }} />
        </nav>

        <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <div className={cn("bg-white rounded-lg border border-slate-200 flex flex-col gap-1.5 transition-all", isCollapsed ? "p-1.5 items-center" : "p-3")}>
             {!isCollapsed && (
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Health</div>
                {isSimulated ? (
                  <div className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-bold text-amber-700 uppercase tracking-wider shadow-sm">
                    Sim
                  </div>
                ) : (
                  <div className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[9px] font-bold text-emerald-700 uppercase tracking-wider shadow-sm">
                    Live
                  </div>
                )}
              </div>
             )}
             <div className="flex items-center justify-center lg:justify-between w-full">
                {!isCollapsed && <span className="text-xs font-semibold text-slate-600">Active Node</span>}
                <span className={cn("relative flex h-2 w-2", isCollapsed ? "mx-auto" : "")}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 z-10"></span>
                </span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden pt-14 lg:pt-0 bg-slate-50">
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, isCollapsed = false, onClick, className }: { icon: ReactNode, label: string, active?: boolean, isCollapsed?: boolean, onClick?: () => void, className?: string }) {
  return (
    <div 
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={cn(
        "flex items-center transition-all group cursor-pointer",
        isCollapsed ? "justify-center py-2 px-0 mx-2 rounded-md" : "gap-3 px-4 py-2 border-l-[3px]",
        active ? 
          (isCollapsed ? 'bg-blue-50 text-blue-600 shadow-sm' : 'bg-blue-50/50 text-blue-700 border-blue-600') : 
          (isCollapsed ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'),
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

