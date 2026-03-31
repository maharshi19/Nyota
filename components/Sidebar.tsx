
import React, { useState } from 'react';
import { 
  Home, 
  Settings, 
  Users, 
  HeartHandshake, 
  ShieldAlert,
  FolderOpen,
  BarChart2,
  Baby,
  CalendarCheck,
  Building2,
  PieChart,
  LayoutGrid,
  Activity,
  ClipboardList,
  MapPin,
  Stethoscope,
  FileCheck,
  Globe,
  Layers,
  CloudSun,
  Calculator,
  Trophy,
  ChevronDown,
  ChevronRight,
  Folder,
  MessageSquare
} from 'lucide-react';
import { BoardItem, PillarType, UserSession } from '../types';
import { dashboardTheme } from '../utils/dashboardTheme';

interface SidebarProps {
  activePillar: PillarType;
  currentView: string;
  onViewChange: (view: any) => void;
  selectedMember: BoardItem | null;
  currentSession?: UserSession;
}

const Sidebar: React.FC<SidebarProps> = ({ activePillar, currentView, onViewChange, selectedMember, currentSession }) => {
  const palette = dashboardTheme;
  const [isExecutiveFolderOpen, setIsExecutiveFolderOpen] = useState(true);

  return (
    <aside className="w-[64px] md:w-[260px] h-screen text-slate-800 flex flex-col flex-shrink-0 transition-all duration-300 border-r z-50" style={{ background: 'linear-gradient(180deg, #f7fbf9, #edf4f0)', borderColor: '#c8d7cf' }}>
      {/* Top Brand Area */}
      <div className="h-[72px] flex items-center justify-center md:justify-start md:px-5 border-b shrink-0" style={{ borderColor: '#c8d7cf', background: 'linear-gradient(180deg, #eef5f1, #e7f0ec)' }}>
        <div className="flex items-center gap-3">
          <img
            src="/nyota-logo.svg"
            alt="Nyota Health"
            className="h-8 w-8 md:h-9 md:w-9 object-contain"
          />
          <div className="hidden md:block">
            <div className="text-[13px] font-black tracking-tight leading-none" style={{ color: '#1f2f2a' }}>Nyota Health</div>
            <div className="text-[9px] font-bold tracking-widest uppercase mt-0.5" style={{ color: '#d9b07c' }}>Command Tower</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto custom-scrollbar">
        
        {/* PILLAR 1: MCO NAVIGATION */}
        {activePillar === 'mco' && (
          <>
            <div className="px-3 mb-2 mt-1 text-[9px] uppercase font-black tracking-[0.25em] hidden md:block" style={{ color: '#70867e' }}>
              MCO Oversight
            </div>
            
            {/* EXECUTIVE FOLDER */}
            <div className="mb-1">
              <button 
                onClick={() => setIsExecutiveFolderOpen(!isExecutiveFolderOpen)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 group w-full"
                style={{ backgroundColor: isExecutiveFolderOpen ? '#e2eee8' : 'transparent' }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isExecutiveFolderOpen ? '#d3e6de' : 'transparent' }}>
                  <Folder className="w-3.5 h-3.5" style={{ color: isExecutiveFolderOpen ? palette.goldSoft : palette.muted }} />
                </div>
                <span className="hidden md:block text-[11px] font-black flex-1 text-left tracking-tight" style={{ color: '#38564d' }}>Executive Pulse</span>
                <div className="hidden md:block" style={{ color: '#7d9a90' }}>
                  {isExecutiveFolderOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </button>
              
              {isExecutiveFolderOpen && (
                <div className="mt-0.5 flex flex-col gap-0.5 md:ml-3 border-l pl-2 animate-fadeIn" style={{ borderColor: '#c8d7cf' }}>
                  <NavItem 
                    icon={<LayoutGrid className="w-3.5 h-3.5" />} 
                    label="Strategic Overview" 
                    active={currentView === 'dashboard'} 
                    onClick={() => onViewChange('dashboard')}
                    compact
                  />
                  <NavItem 
                    icon={<Layers className="w-3.5 h-3.5" />} 
                    label="Module A: Risk" 
                    active={currentView === 'stratification'} 
                    onClick={() => onViewChange('stratification')}
                    compact
                    iconColor={palette.critical}
                  />
                  <NavItem 
                    icon={<CloudSun className="w-3.5 h-3.5" />} 
                    label="Module B: Env/SDOH" 
                    active={currentView === 'environment-sdoh'} 
                    onClick={() => onViewChange('environment-sdoh')}
                    compact
                    iconColor={palette.tealBright}
                  />
                  <NavItem 
                    icon={<Calculator className="w-3.5 h-3.5" />} 
                    label="Module C: ROI" 
                    active={currentView === 'roi'} 
                    onClick={() => onViewChange('roi')}
                    compact
                    iconColor={palette.teal}
                  />
                  <NavItem 
                    icon={<Trophy className="w-3.5 h-3.5" />} 
                    label="Module D: Quality" 
                    active={currentView === 'quality-scorecard'} 
                    onClick={() => onViewChange('quality-scorecard')}
                    compact
                    iconColor={palette.goldSoft}
                  />
                </div>
              )}
            </div>

            <NavItem 
              icon={<Globe className="w-4 h-4" />} 
              label="Care Force Command" 
              active={currentView === 'careforce'} 
              onClick={() => onViewChange('careforce')}
              iconColor={palette.teal}
            />
            <NavItem 
              icon={<PieChart className="w-4 h-4" />} 
              label="Equity Stratification" 
              active={currentView === 'equity'} 
              onClick={() => onViewChange('equity')}
              iconColor={palette.goldSoft}
            />
            <NavItem 
              icon={<Building2 className="w-4 h-4" />} 
              label="Birthing-Friendly Sites" 
              active={currentView === 'facility'} 
              onClick={() => onViewChange('facility')}
              iconColor={palette.tealBright}
            />
            <NavItem 
              icon={<FileCheck className="w-4 h-4" />} 
              label="HEDIS Quality Center" 
              active={currentView === 'hedis'}
              onClick={() => onViewChange('hedis')}
              iconColor={palette.goldSoft}
            />
          </>
        )}

        {/* PILLAR 2: CLINICAL NAVIGATION */}
        {activePillar === 'clinical' && (
          <>
            <div className="px-3 mb-2 mt-1 text-[9px] uppercase font-black tracking-[0.25em] hidden md:block" style={{ color: '#70867e' }}>
              Diagnostic Ops
            </div>
            <NavItem 
              icon={<ShieldAlert className="w-4 h-4" />} 
              label="High-Urgency Feed" 
              active={currentView === 'high-urgency-feed'} 
              onClick={() => onViewChange('high-urgency-feed')}
              iconColor={palette.critical}
            />
            <NavItem 
              icon={<ClipboardList className="w-4 h-4" />} 
              label="Member Clinical Board" 
              active={currentView === 'clinical-board'} 
              onClick={() => onViewChange('clinical-board')}
              iconColor={palette.teal}
            />
            <NavItem 
              icon={<Stethoscope className="w-4 h-4" />} 
              label="Protocol Validation" 
              active={currentView === 'clinical-diagnostics'} 
              onClick={() => onViewChange('clinical-diagnostics')}
              iconColor={palette.goldSoft}
            />
            <NavItem 
              icon={<MessageSquare className="w-4 h-4" />} 
              label="Care Team Messaging" 
              active={currentView === 'messaging'} 
              onClick={() => onViewChange('messaging')}
              iconColor={palette.tealBright}
            />
          </>
        )}

        {/* PILLAR 3: COMMUNITY NAVIGATION */}
        {activePillar === 'community' && (
          <>
            <div className="px-3 mb-2 mt-1 text-[9px] uppercase font-black tracking-[0.25em] hidden md:block" style={{ color: '#70867e' }}>
              Field & Support
            </div>
            <NavItem 
              icon={<CalendarCheck className="w-4 h-4" />} 
              label="Care Force Tracker" 
              active={currentView === 'support'} 
              onClick={() => onViewChange('support')}
              subLabel={selectedMember ? `Member: ${selectedMember.name}` : "Collective View"}
              iconColor={palette.teal}
            />
            <NavItem 
              icon={<Baby className="w-4 h-4" />} 
              label="Member Birth Intent" 
              active={currentView === 'birthplan'} 
              onClick={() => onViewChange('birthplan')}
              subLabel={selectedMember ? `Member: ${selectedMember.name}` : "Collective View"}
              iconColor={palette.goldSoft}
            />
            <NavItem 
              icon={<MapPin className="w-4 h-4" />} 
              label="Field Dispatch Map" 
              iconColor={palette.goldSoft}
            />
            <NavItem 
              icon={<HeartHandshake className="w-4 h-4" />} 
              label="Doula/CHW Connect" 
              iconColor={palette.critical}
            />
          </>
        )}

        {/* Divider */}
        <div className="my-3 mx-3 border-t" style={{ borderColor: '#c8d7cf' }} />
        
        {/* MCO Data Portal */}
        <NavItem 
          icon={<Building2 className="w-4 h-4" />} 
          label="MCO Data Portal" 
          active={currentView === 'mco-portal'} 
          onClick={() => onViewChange('mco-portal')}
          iconColor={palette.tealBright}
          highlight
        />
        
        {/* Admin/Supervisor Navigation */}
        {currentSession?.user.role === 'Admin' && (
          <>
            <NavItem 
              icon={<ShieldAlert className="w-4 h-4" />} 
              label="Admin Dashboard" 
              active={currentView === 'admin-dashboard'} 
              onClick={() => onViewChange('admin-dashboard')}
              iconColor={palette.critical}
            />
            <NavItem 
              icon={<Users className="w-4 h-4" />} 
              label="User Management" 
              active={currentView === 'user-management'} 
              onClick={() => onViewChange('user-management')}
              iconColor={palette.teal}
            />
          </>
        )}
        
        {currentSession?.user.role === 'State Lead MCO Supervisor' && (
          <NavItem 
            icon={<BarChart2 className="w-4 h-4" />} 
            label="Supervisor Dashboard" 
            active={currentView === 'supervisor-dashboard'} 
            onClick={() => onViewChange('supervisor-dashboard')}
            iconColor={palette.goldSoft}
          />
        )}
        
        <NavItem icon={<Activity className="w-4 h-4" />} label="System Pulse" onClick={() => onViewChange('system-pulse')} iconColor={palette.teal} />
        <NavItem icon={<Settings className="w-4 h-4" />} label="Tower Config" onClick={() => onViewChange('tower-config')} />
      </nav>

      {/* Bottom Profile */}
      <div className="p-4 border-t shrink-0" style={{ borderColor: '#c8d7cf', backgroundColor: '#e7f0ec' }}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${currentSession?.user.color || 'bg-gradient-to-tr from-teal-700 to-stone-700'} flex items-center justify-center text-sm font-black shadow-lg ring-2 ring-white/10`}>
            {currentSession?.user.initials || 'CM'}
          </div>
          <div className="hidden md:block flex-1 min-w-0">
            <div className="text-[12px] font-black leading-none mb-0.5 truncate" style={{ color: '#1f2f2a' }}>{currentSession?.user.name || 'State Lead'}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: palette.muted }}>
              {currentSession?.user.role === 'State Lead MCO Supervisor' ? 'MCO Supervisor' : 
               currentSession?.user.role === 'Admin' ? 'System Admin' : 
               currentSession?.user.role}
            </div>
          </div>
          <div className="hidden md:flex w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: palette.tealBright, boxShadow: `0 0 6px ${palette.tealBright}` }} title="Online"></div>
        </div>
      </div>
    </aside>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  subLabel?: string;
  compact?: boolean;
  iconColor?: string;
  highlight?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, count, onClick, subLabel, compact = false, iconColor, highlight = false }) => {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col gap-0 rounded-xl transition-all duration-150 group w-full
      ${compact ? 'px-2.5 py-2' : 'px-2.5 py-2.5'}`}
      style={
        active
          ? { backgroundColor: '#e3f0eb', boxShadow: 'inset 0 0 0 1px #b8d2c8' }
          : highlight && !active
          ? { backgroundColor: 'rgba(47,138,116,0.12)' }
          : undefined
      }
    >
      <div className="flex items-center gap-2.5 w-full">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150
          ${active ? 'shadow-md' : 'group-hover:scale-105'}`}
          style={{
            backgroundColor: active
              ? 'rgba(47,138,116,0.18)'
              : highlight && !active
              ? 'rgba(47,138,116,0.14)'
              : 'rgba(47,138,116,0.08)',
            color: active ? '#2f8a74' : iconColor || '#6f8c83',
          }}
        >
          {icon}
        </div>
        <span className={`hidden md:block text-[11px] font-bold flex-1 text-left truncate tracking-tight
          ${active ? 'text-teal-900' : highlight ? 'text-teal-800' : 'text-slate-600 group-hover:text-slate-800'}
          ${compact ? 'text-[10px]' : ''}`}
        >{label}</span>
        {count && (
          <span className="hidden md:flex text-white text-[9px] font-black px-1.5 h-4 rounded-full items-center justify-center shrink-0"
            style={{ backgroundColor: '#b91c1c' }}>
            {count}
          </span>
        )}
        {active && <div className="hidden md:block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#2f8a74' }}></div>}
      </div>
      {subLabel && (
        <span className={`hidden md:block ml-10 text-[9px] font-bold truncate leading-none uppercase tracking-tighter
          ${active ? 'text-slate-500' : 'text-slate-600'}`}>
          {subLabel}
        </span>
      )}
    </button>
  );
};

export default Sidebar;
