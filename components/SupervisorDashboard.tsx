import React, { useState, useEffect } from 'react';
import { BarChart2, Users, TrendingUp, AlertTriangle, CheckCircle, Clock, Target, Award, Activity } from 'lucide-react';
import { UserSession, BoardGroup } from '../types';
import { dashboardTheme } from '../utils/dashboardTheme';

interface SupervisorDashboardProps {
  currentSession: UserSession;
  boardGroups: BoardGroup[];
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ currentSession, boardGroups }) => {
  const palette = dashboardTheme;

  const [metrics, setMetrics] = useState({
    totalCases: 0,
    criticalCases: 0,
    teamPerformance: 85,
    avgResolutionTime: 24,
    complianceRate: 94,
    escalationRate: 3
  });

  const [teamMembers] = useState([
    { id: '1', name: 'Dr. Sarah Chen', role: 'MCO Case Manager', cases: 12, performance: 92 },
    { id: '2', name: 'Mark Davis', role: 'Care Navigator', cases: 8, performance: 88 },
    { id: '3', name: 'Lisa Anderson', role: 'Clinical Coordinator', cases: 15, performance: 95 }
  ]);

  const [recentEscalations] = useState([
    { id: 1, patient: 'Jane Smith', issue: 'Critical hypertension', priority: 'high', time: '2 hours ago' },
    { id: 2, patient: 'Maria Garcia', issue: 'Postpartum complication', priority: 'high', time: '4 hours ago' },
    { id: 3, patient: 'Sarah Johnson', issue: 'Medication adherence', priority: 'medium', time: '6 hours ago' }
  ]);

  useEffect(() => {
    // Calculate metrics from boardGroups
    const allItems = boardGroups.flatMap(g => g.items);
    const criticalItems = allItems.filter(item => item.status === 'Critical');

    setMetrics({
      totalCases: allItems.length,
      criticalCases: criticalItems.length,
      teamPerformance: 85,
      avgResolutionTime: 24,
      complianceRate: 94,
      escalationRate: 3
    });
  }, [boardGroups]);

  const getPriorityStyles = (priority: string): { bg: string; color: string } => {
    if (priority === 'high') return { bg: palette.criticalBg, color: palette.critical };
    if (priority === 'medium') return { bg: palette.warningBg, color: palette.warning };
    return { bg: palette.stableBg, color: palette.stable };
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar" style={{ backgroundColor: palette.surface }}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
          style={{ background: `linear-gradient(135deg, #0a5c52 0%, ${palette.teal} 60%, ${palette.tealBright} 100%)` }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #ffffff 0%, transparent 60%)' }} />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-xl">
                <BarChart2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Supervisor Dashboard</h1>
                <p className="text-sm mt-0.5 text-green-100">State Lead MCO — Operations Oversight</p>
              </div>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-green-200">Updated</div>
              <div className="text-sm font-black">{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>

        {/* ── Key Metrics Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Active Cases',   value: metrics.totalCases,                         icon: Users,          color: palette.teal,     sub: `${metrics.criticalCases} critical`,  bg: palette.stableBg },
            { label: 'Team Performance',     value: `${metrics.teamPerformance}%`,               icon: Award,          color: palette.teal,     sub: '+2.3% vs last mo',                  bg: palette.stableBg },
            { label: 'Avg Resolution',       value: `${metrics.avgResolutionTime}h`,             icon: Clock,          color: palette.warning,  sub: 'Target < 48h',                      bg: palette.warningBg },
            { label: 'Compliance Rate',      value: `${metrics.complianceRate}%`,                icon: CheckCircle,    color: palette.teal,     sub: 'HEDIS measures',                    bg: palette.stableBg },
            { label: 'Escalation Rate',      value: `${metrics.escalationRate}%`,                icon: AlertTriangle,  color: palette.critical, sub: 'Requires attention',                bg: palette.criticalBg },
            { label: 'State Coverage',       value: '98.5%',                                    icon: Target,         color: palette.teal,     sub: 'All regions active',                bg: palette.stableBg },
          ].map(({ label, value, icon: Icon, color, sub, bg }) => (
            <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border" style={{ borderColor: palette.border }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>{sub}</span>
              </div>
              <div className="text-2xl font-black mb-0.5" style={{ color: palette.text }}>{value}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Team Performance ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: palette.border }}>
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: palette.borderLight, backgroundColor: palette.surface }}>
              <Users className="w-4 h-4" style={{ color: palette.teal }} />
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Team Performance</h2>
            </div>
            <div className="divide-y p-2" style={{ borderColor: palette.borderLight }}>
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-white"
                    style={{ background: `linear-gradient(135deg, ${palette.teal}, ${palette.tealBright})` }}>
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{member.name}</p>
                    <p className="text-[11px] text-slate-400">{member.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full" style={{ width: `${member.performance}%`, backgroundColor: palette.tealBright }} />
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: palette.teal }}>{member.performance}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black" style={{ color: palette.text }}>{member.cases}</span>
                    <p className="text-[10px] text-slate-400">cases</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent Escalations ───────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: palette.border }}>
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: palette.borderLight, backgroundColor: palette.surface }}>
              <AlertTriangle className="w-4 h-4" style={{ color: palette.critical }} />
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Recent Escalations</h2>
            </div>
            <div className="divide-y" style={{ borderColor: palette.borderLight }}>
              {recentEscalations.map((escalation) => {
                const { bg, color } = getPriorityStyles(escalation.priority);
                return (
                  <div key={escalation.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{escalation.patient}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{escalation.issue}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: bg, color }}>{escalation.priority} priority</span>
                        <span className="text-[10px] text-slate-400">{escalation.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── State-Wide Operations Banner ─────────────────────────── */}
        <div className="rounded-2xl p-6 text-white shadow overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${palette.navy} 0%, ${palette.navyLight} 100%)` }}>
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 70% 60%, #27897e 0%, transparent 55%)' }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <Activity className="w-5 h-5" style={{ color: palette.tealBright }} />
              <h3 className="font-black tracking-tight">State Lead MCO Supervisor Access</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { val: metrics.totalCases, label: 'Active Cases' },
                { val: teamMembers.length, label: 'Team Members' },
                { val: recentEscalations.length, label: 'Open Escalations' },
                { val: '12', label: 'Regions Covered' },
              ].map(({ val, label }) => (
                <div key={label} className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                  <div className="text-2xl font-black" style={{ color: palette.tealBright }}>{val}</div>
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: palette.mintDark }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Supervisor Action Buttons ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Users,        label: 'Team Management',    sub: 'Assign cases & monitor performance', color: palette.teal,    bg: palette.stableBg },
            { icon: AlertTriangle,label: 'Escalation Review',  sub: 'Handle critical case escalations',   color: palette.critical,bg: palette.criticalBg },
            { icon: BarChart2,    label: 'Performance Reports', sub: 'Generate team analytics',           color: palette.warning, bg: palette.warningBg },
          ].map(({ icon: Icon, label, sub, color, bg }) => (
            <button key={label} className="flex items-center gap-4 p-5 rounded-2xl border bg-white hover:shadow-md transition-all text-left"
              style={{ borderColor: palette.border }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <div className="font-bold text-slate-900">{label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};

export default SupervisorDashboard;
