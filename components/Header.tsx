
import React, { useState, useEffect, useRef } from 'react';
import { Search, Globe, ChevronRight, Activity, LayoutGrid, BrainCircuit, Users, ChevronDown } from 'lucide-react';
import { PillarType, UserSession, TeamMember } from '../types';
import { dashboardTheme } from '../utils/dashboardTheme';

interface HeaderProps {
  activePillar: PillarType;
  onPillarChange: (pillar: PillarType) => void;
  onSearch: (query: string) => void;
  currentSession?: UserSession;
  onSessionChange?: (user: TeamMember) => void;
  availableUsers?: TeamMember[];
}

const Header: React.FC<HeaderProps> = ({ activePillar, onPillarChange, onSearch, currentSession, onSessionChange, availableUsers }) => {
  const palette = dashboardTheme;
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch(searchQuery);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length >= 2) {
      onSearch(val);
    } else if (val.length === 0) {
      onSearch('');
    }
  };

  return (
    <header className="border-b h-[72px] flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm" style={{ background: 'linear-gradient(180deg, #f8fbf9, #edf4f0)', borderColor: '#cfddd5' }}>
      <div className="flex items-center gap-5">
        <div className="hidden md:flex items-center">
          <img
            src="/nyota-logo.svg"
            alt="Nyota Health"
            className="h-9 w-auto object-contain"
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest leading-none mb-1" style={{ color: '#6c8a80' }}>
             <Globe className="w-3 h-3" />
             <span>Nyota OS</span>
             <ChevronRight className="w-3 h-3" />
             <span>TMaH model</span>
          </div>
          <div className="flex items-center gap-3">
             <h1 className="text-xl font-black tracking-tight" style={{ color: '#1f2f2a' }}>Command Tower</h1>
             <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border" style={{ backgroundColor: '#e6f3ef', color: '#2f8a74', borderColor: '#bed4cb' }}>
               <Activity className="w-3 h-3" />
               LIVE
             </div>
          </div>
        </div>

        {/* THREE PILLARS TABS */}
        <div className="flex items-center p-1 rounded-xl" style={{ backgroundColor: '#e2ece7' }}>
           <PillarTab 
             active={activePillar === 'mco'} 
             onClick={() => onPillarChange('mco')} 
             label="MCO Oversight" 
             icon={<LayoutGrid className="w-4 h-4" />}
             activeColor={palette.teal}
             palette={palette}
           />
           <PillarTab 
             active={activePillar === 'clinical'} 
             onClick={() => onPillarChange('clinical')} 
             label="Clinical Diagnostics" 
             icon={<BrainCircuit className="w-4 h-4" />}
             activeColor={palette.navy}
             palette={palette}
           />
           <PillarTab 
             active={activePillar === 'community'} 
             onClick={() => onPillarChange('community')} 
             label="Community Care" 
             icon={<Users className="w-4 h-4" />}
             activeColor={palette.gold}
             palette={palette}
           />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden lg:block">
          <Search className="w-4 h-4 absolute left-3 top-2.5" style={{ color: '#739188' }} />
           <input 
             type="text" 
             value={searchQuery}
             onChange={handleChange}
             onKeyDown={handleKeyDown}
             placeholder="Search MRN, SSN, name, complaint..." 
                 className="pl-9 pr-4 py-2 rounded-xl text-xs w-64 focus:ring-2 outline-none transition-all"
               style={{ backgroundColor: '#f7fbf9', color: '#1f2f2a', border: '1px solid #c8d7cf', ['--tw-ring-color' as any]: palette.teal }}
           />
        </div>
             <div className="w-px h-8" style={{ backgroundColor: '#c8d7cf' }}></div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black" style={{ color: '#1f2f2a' }}>
              {currentSession?.user.role === 'Admin' ? 'Admin Session' : 
               currentSession?.user.role === 'State Lead MCO Supervisor' ? 'Supervisor Session' : 
               'User Session'}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: '#6f8c83' }}>
              {currentSession?.user.permissions?.canAccessStatewide ? 'State-Wide Access' : 'Local Access'}
            </span>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`w-9 h-9 rounded-xl ${currentSession?.user.color || 'bg-teal-600'} flex items-center justify-center text-white text-xs font-black shadow-lg shadow-slate-900/20 flex items-center gap-1`}
            >
              {currentSession?.user.initials || 'NY'}
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showUserMenu && availableUsers && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-lg shadow-lg border z-50" style={{ backgroundColor: '#f8fbf9', borderColor: '#c8d7cf' }}>
                <div className="p-3 border-b" style={{ borderColor: '#c8d7cf' }}>
                  <p className="text-sm font-medium" style={{ color: '#1f2f2a' }}>Switch User Session</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {availableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        onSessionChange?.(user);
                        setShowUserMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center gap-3 ${
                        currentSession?.user.id === user.id ? '' : ''
                      }`}
                      style={{ backgroundColor: currentSession?.user.id === user.id ? '#e4f1ec' : '#f8fbf9' }}
                    >
                      <div className={`w-6 h-6 rounded-full ${user.color} flex items-center justify-center text-xs font-bold text-white`}>
                        {user.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1f2f2a' }}>{user.name}</p>
                        <p className="text-xs truncate" style={{ color: '#6f8c83' }}>{user.role}</p>
                      </div>
                      {currentSession?.user.id === user.id && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: palette.teal }}></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const PillarTab = ({ active, onClick, label, icon, activeColor, palette }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all duration-200
      ${active ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
    style={active ? { color: activeColor, border: `1px solid ${palette.border}` } : undefined}
  >
    {icon}
    <span className="tracking-tight">{label}</span>
  </button>
);

export default Header;
