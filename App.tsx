
import React, { useState, useEffect, useMemo } from 'react';
import { DataProvider } from './DataContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PatientBoard from './components/PatientBoard';
import DashboardView from './components/DashboardView';
import ItemPanel from './components/ItemPanel';
import ActionFeed from './components/ActionFeed';
import EquityStratificationView from './components/EquityStratificationView';
import BirthingFriendlyView from './components/BirthingFriendlyView';
import ContinuousSupportView from './components/ContinuousSupportView';
import BirthPlanPerspectiveView from './components/BirthPlanPerspectiveView';
import HEDISReportingView from './components/HEDISReportingView';
import CareForceView from './components/CareForceView';
import PopulationRiskView from './components/PopulationRiskView';
import EnvironmentalSDOHView from './components/EnvironmentalSDOHView';
import ProgrammaticROIView from './components/ProgrammaticROIView';
import TMaHQualityScorecardView from './components/TMaHQualityScorecardView';
import ClinicalDiagnosticsView from './components/ClinicalDiagnosticsView';
import MessagingHub from './components/MessagingHub';
import SystemPulseView from './components/SystemPulseView';
import TowerConfigView from './components/TowerConfigView';
import AdminDashboard from './components/AdminDashboard';
import UserManagementView from './components/UserManagementView';
import SupervisorDashboard from './components/SupervisorDashboard';
import MCOPortal from './components/MCOPortal';
import { PatientCase, AppStatus, BoardGroup, BoardItem, TeamMember, PillarType, UserSession, UserPermissions } from './types';
import { analyzeCase } from './services/gemini';
import { dashboardTheme } from './utils/dashboardTheme';

const MOCK_TEAM: TeamMember[] = [
  { 
    id: '1', 
    name: 'Dr. Sarah Chen', 
    role: 'MCO Case Manager', 
    initials: 'SC', 
    color: 'bg-teal-600',
    permissions: {
      canViewAllData: false,
      canEditUsers: false,
      canApproveActions: false,
      canAccessStatewide: false,
      canManageTeams: false,
      canViewAnalytics: false
    },
    department: 'Clinical Operations'
  },
  { 
    id: '2', 
    name: 'Mark Davis', 
    role: 'Care Navigator', 
    initials: 'MD', 
    color: 'bg-teal-700',
    permissions: {
      canViewAllData: false,
      canEditUsers: false,
      canApproveActions: false,
      canAccessStatewide: false,
      canManageTeams: false,
      canViewAnalytics: false
    },
    department: 'Member Services'
  },
  {
    id: '3',
    name: 'Dr. Elena Rodriguez',
    role: 'State Lead MCO Supervisor',
    initials: 'ER',
    color: 'bg-stone-700',
    permissions: {
      canViewAllData: true,
      canEditUsers: true,
      canApproveActions: true,
      canAccessStatewide: true,
      canManageTeams: true,
      canViewAnalytics: true
    },
    department: 'Executive Leadership'
  },
  {
    id: '4',
    name: 'James Wilson',
    role: 'Admin',
    initials: 'JW',
    color: 'bg-slate-700',
    permissions: {
      canViewAllData: true,
      canEditUsers: true,
      canApproveActions: true,
      canAccessStatewide: true,
      canManageTeams: true,
      canViewAnalytics: true
    },
    department: 'System Administration'
  }
];

// groups will be populated from the CSV backend



type ViewType = 'board' | 'dashboard' | 'equity' | 'facility' | 'support' | 'birthplan' | 'hedis' | 'careforce' | 'stratification' | 'environment-sdoh' | 'roi' | 'quality-scorecard' | 'clinical-diagnostics' | 'messaging' | 'system-pulse' | 'tower-config' | 'high-urgency-feed' | 'clinical-board' | 'admin-dashboard' | 'user-management' | 'supervisor-dashboard';

function App() {
  const palette = dashboardTheme;
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([]);
  const [selectedItem, setSelectedItem] = useState<BoardItem | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // THREE PILLARS
  const [activePillar, setActivePillar] = useState<PillarType>('mco');
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [searchedMember, setSearchedMember] = useState<BoardItem | null>(null);

  // Session Management
  const [currentSession, setCurrentSession] = useState<UserSession>({
    user: MOCK_TEAM[3], // Start with Admin user
    isAuthenticated: true,
    sessionStart: new Date(),
    lastActivity: new Date(),
    accessLevel: 'admin'
  });

  const handleSessionChange = (user: TeamMember) => {
    const accessLevel = user.role === 'Admin' ? 'admin' : 
                       user.role === 'State Lead MCO Supervisor' ? 'supervisor' : 'user';
    
    setCurrentSession({
      user,
      isAuthenticated: true,
      sessionStart: new Date(),
      lastActivity: new Date(),
      accessLevel: accessLevel as 'admin' | 'supervisor' | 'user'
    });
  };

  const allMembers = useMemo(() => boardGroups.flatMap(g => g.items), [boardGroups]);

  // load data from CSV-backed API on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/board');
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        if (!cancelled) {
          setBoardGroups(data.groups || []);
          console.log('[App] Data loaded successfully:', data.groups?.length, 'groups');
        }
      } catch (e) {
        console.error('[App] failed to load board groups', e);
        if (!cancelled) {
          setTimeout(load, 5000);
        }
      }
    }
    load(); // load immediately on mount
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Pillar Change Logic
  const handlePillarChange = (pillar: PillarType) => {
    setActivePillar(pillar);
    // Set sensible defaults for the pillar
    if (pillar === 'mco') setCurrentView('dashboard');
    else if (pillar === 'clinical') setCurrentView('clinical-diagnostics');
    else if (pillar === 'community') setCurrentView('support');
  };

  const handleItemClick = (item: BoardItem) => {
    setSelectedItem(item);
    setSearchedMember(item);
    setIsPanelOpen(true);
    setAppStatus(item.analysis ? AppStatus.COMPLETE : AppStatus.IDLE);
  };

  const handleSearch = (query: string) => {
    if (!query) {
      setSearchedMember(null);
      setSelectedItem(null);
      setIsPanelOpen(false);
      return;
    }
    const cleanQuery = query.toLowerCase().replace(/[-\s]/g, '');
    const found = allMembers.find(item => {
      const itemMrn = item.mrn.toLowerCase().replace(/[-\s]/g, '');
      const itemSsn = (item.caseData.ssn || '').toLowerCase().replace(/[-\s]/g, '');
      const itemName = item.name.toLowerCase().replace(/[-\s]/g, '');
      const complaint = (item.caseData.chiefComplaint || '').toLowerCase();
      return (
        itemMrn.includes(cleanQuery) ||
        itemSsn.includes(cleanQuery) ||
        itemName.includes(cleanQuery) ||
        complaint.includes(cleanQuery)
      );
    });

    if (found) {
      setSearchedMember(found);
      setSelectedItem(found);
      setIsPanelOpen(true);
      setAppStatus(found.analysis ? AppStatus.COMPLETE : AppStatus.IDLE);
    } else {
      setSearchedMember(null);
      setSelectedItem(null);
      setIsPanelOpen(false);
    }
  };

  const handleAnalyze = async (data: PatientCase) => {
    if (!selectedItem) return;
    setAppStatus(AppStatus.ANALYZING);
    try {
      const result = await analyzeCase(data);
      const updatedGroups = boardGroups.map(group => ({
        ...group,
        items: group.items.map(item => {
           if (item.id === selectedItem.id) {
              return { 
                ...item, 
                analysis: result, 
                caseData: data, 
                updatesCount: item.updatesCount + 1,
                status: result.riskScore.level === 'Critical' ? 'Critical' : item.status
              };
           }
           return item;
        })
      }));
      setBoardGroups(updatedGroups);
      const updatedItem = { ...selectedItem, analysis: result, caseData: data };
      setSelectedItem(updatedItem);
      setSearchedMember(updatedItem);
      setAppStatus(AppStatus.COMPLETE);
    } catch (err) {
      console.error(err);
      setAppStatus(AppStatus.ERROR);
    }
  };

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <DashboardView groups={boardGroups} />;
      case 'equity': return <EquityStratificationView />;
      case 'facility': return <BirthingFriendlyView />;
      case 'support': return <ContinuousSupportView selectedMember={searchedMember} />;
      case 'birthplan': return <BirthPlanPerspectiveView selectedMember={searchedMember} />;
      case 'hedis': return <HEDISReportingView />;
      case 'careforce': return <CareForceView />;
      case 'stratification': return <PopulationRiskView />;
      case 'environment-sdoh': return <EnvironmentalSDOHView />;
      case 'roi': return <ProgrammaticROIView />;
      case 'quality-scorecard': return <TMaHQualityScorecardView />;
      case 'clinical-diagnostics': return <ClinicalDiagnosticsView />;
      case 'messaging': return <MessagingHub />;
      case 'system-pulse': return <SystemPulseView />;
      case 'tower-config': return <TowerConfigView />;
      case 'high-urgency-feed': return (
        <div className="flex-1 p-4 h-full overflow-hidden bg-white">
          <ActionFeed items={allMembers} onItemClick={handleItemClick} />
        </div>
      );
      case 'clinical-board': return (
        <div className="flex-1 h-full overflow-y-auto bg-white">
          <PatientBoard groups={boardGroups} onItemClick={handleItemClick} />
        </div>
      );
      case 'admin-dashboard': return <AdminDashboard currentSession={currentSession} />;
      case 'user-management': return <UserManagementView team={MOCK_TEAM} currentSession={currentSession} />;
      case 'supervisor-dashboard': return <SupervisorDashboard currentSession={currentSession} boardGroups={boardGroups} />;
      case 'mco-portal': return <MCOPortal onViewChange={setCurrentView} />;
      case 'board':
      default:
        if (boardGroups.length === 0) {
          return (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">Loading Clinical Data...</h3>
                <p className="text-sm text-slate-500">Make sure CSV server is running: npm run csv-server</p>
              </div>
            </div>
          );
        }
        return (
          <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white">
            <div className="w-full md:w-80 lg:w-[400px] p-4 h-full border-r border-slate-200">
              <ActionFeed items={allMembers} onItemClick={handleItemClick} />
            </div>
            <div className="flex-1 h-full overflow-y-auto bg-white">
              <PatientBoard groups={boardGroups} onItemClick={handleItemClick} />
            </div>
          </div>
        );
    }
  };

  return (
    <DataProvider groups={boardGroups}>
      <div
        className="flex h-screen font-sans text-slate-900 overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #eef3ef 0%, #e6efe8 48%, #e9f3ef 100%)' }}
      >
        <Sidebar 
          activePillar={activePillar}
          currentView={currentView}
          onViewChange={setCurrentView}
          selectedMember={searchedMember}
          currentSession={currentSession}
        />
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
           <Header 
              activePillar={activePillar}
              onPillarChange={handlePillarChange}
              onSearch={handleSearch}
              currentSession={currentSession}
              onSessionChange={handleSessionChange}
              availableUsers={MOCK_TEAM}
           />
           
           <div className="flex-1 flex flex-col h-full overflow-hidden">
              {renderView()}
           </div>
        </div>

        {selectedItem && (
          <ItemPanel 
            item={selectedItem}
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            onAnalyze={handleAnalyze}
            status={appStatus}
          />
        )}
      </div>
    </DataProvider>
  );
}

export default App;
