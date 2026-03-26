import React, { useState, useEffect } from 'react';
import { Shield, Users, Activity, AlertTriangle, TrendingUp, Server, Database, Lock, UserCheck, Settings } from 'lucide-react';
import { UserSession, TeamMember } from '../types';
import { dashboardTheme } from '../utils/dashboardTheme';

interface AdminDashboardProps {
  currentSession: UserSession;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentSession }) => {
  const palette = dashboardTheme;

  const [systemMetrics, setSystemMetrics] = useState({
    activeUsers: 0,
    totalSessions: 0,
    systemLoad: 0,
    errorRate: 0,
    dataProcessed: 0,
    uptime: 0
  });

  const [recentActivities, setRecentActivities] = useState([
    { id: 1, action: 'User login', user: 'Dr. Sarah Chen', timestamp: '2 min ago', type: 'auth' },
    { id: 2, action: 'System backup completed', user: 'System', timestamp: '15 min ago', type: 'system' },
    { id: 3, action: 'New user created', user: 'Admin', timestamp: '1 hour ago', type: 'user' },
    { id: 4, action: 'Security alert resolved', user: 'Security Team', timestamp: '2 hours ago', type: 'security' }
  ]);

  useEffect(() => {
    // Simulate real-time metrics
    const interval = setInterval(() => {
      setSystemMetrics({
        activeUsers: Math.floor(Math.random() * 50) + 20,
        totalSessions: Math.floor(Math.random() * 200) + 150,
        systemLoad: Math.random() * 100,
        errorRate: Math.random() * 2,
        dataProcessed: Math.floor(Math.random() * 1000) + 500,
        uptime: 99.9
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'auth': return <UserCheck className="w-4 h-4" style={{ color: palette.sage }} />;
      case 'system': return <Server className="w-4 h-4" style={{ color: palette.sage }} />;
      case 'user': return <Users className="w-4 h-4" style={{ color: palette.sand }} />;
      case 'security': return <Lock className="w-4 h-4" style={{ color: palette.rose }} />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar" style={{ backgroundColor: palette.surface }}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
          style={{ background: `linear-gradient(135deg, ${palette.navy} 0%, ${palette.navyLight} 100%)` }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #33a99b 0%, transparent 60%)' }} />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl"
                style={{ background: `linear-gradient(135deg, ${palette.teal}, ${palette.tealBright})` }}>
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Admin Dashboard</h1>
                <p className="text-sm mt-0.5" style={{ color: palette.mintDark }}>System administration & oversight — Full State-Wide Access</p>
              </div>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: palette.goldSoft }}>Session</div>
              <div className="text-sm font-black">{currentSession.sessionStart.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>

        {/* ── System Metrics Grid ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Active Users',     value: systemMetrics.activeUsers,                    icon: Users,     color: palette.teal,     sub: 'Currently logged in',  bg: palette.stableBg },
            { label: 'System Load',      value: `${systemMetrics.systemLoad.toFixed(1)}%`,    icon: Activity,  color: palette.warning,  sub: 'Current utilization',  bg: palette.warningBg },
            { label: 'System Uptime',    value: `${systemMetrics.uptime}%`,                   icon: TrendingUp,color: palette.teal,     sub: 'Last 30 days',         bg: palette.stableBg },
            { label: 'Error Rate',       value: `${systemMetrics.errorRate.toFixed(2)}%`,     icon: AlertTriangle, color: palette.critical, sub: 'System errors',    bg: palette.criticalBg },
            { label: 'Data Processed',   value: `${systemMetrics.dataProcessed} GB`,          icon: Database,  color: palette.teal,     sub: 'This month',           bg: palette.stableBg },
            { label: 'Total Sessions',   value: systemMetrics.totalSessions,                  icon: Settings,  color: palette.textMid,  sub: 'Active sessions',      bg: palette.surfaceAlt },
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

        {/* ── State-Wide Access Banner ─────────────────────────────── */}
        <div className="rounded-2xl p-5 border" style={{ background: `linear-gradient(135deg, ${palette.stableBg}, ${palette.goldBg})`, borderColor: palette.stableBorder }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: palette.teal }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-900">State-Wide Administrative Access</h3>
              <p className="text-[11px] text-slate-500">Full coverage: user management · system config · data oversight</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: '12',    label: 'MCO Regions' },
              { val: '1,247', label: 'System Users' },
              { val: '99.9%', label: 'Availability' },
            ].map(({ val, label }) => (
              <div key={label} className="rounded-xl p-4 text-center bg-white/60 border" style={{ borderColor: palette.stableBorder }}>
                <div className="text-2xl font-black" style={{ color: palette.teal }}>{val}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Recent Activity ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: palette.border }}>
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: palette.borderLight, backgroundColor: palette.surface }}>
              <Activity className="w-4 h-4" style={{ color: palette.teal }} />
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Recent Activity</h2>
            </div>
            <div className="divide-y" style={{ borderColor: palette.borderLight }}>
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      backgroundColor: activity.type === 'security' ? palette.criticalBg
                        : activity.type === 'user' ? palette.warningBg : palette.stableBg
                    }}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{activity.action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">by <span className="font-medium text-slate-600">{activity.user}</span> · {activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Admin Actions ────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: palette.border }}>
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: palette.borderLight, backgroundColor: palette.surface }}>
              <Settings className="w-4 h-4" style={{ color: palette.teal }} />
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Admin Actions</h2>
            </div>
            <div className="p-4 grid grid-cols-1 gap-3">
              {[
                { icon: Users,        label: 'User Management',  sub: 'Manage users & roles',  color: palette.teal,     bg: palette.stableBg },
                { icon: Shield,       label: 'Security Settings', sub: 'Access controls',       color: palette.critical, bg: palette.criticalBg },
                { icon: Database,     label: 'System Backup',    sub: 'Data management',        color: palette.warning,  bg: palette.warningBg },
                { icon: Activity,     label: 'System Logs',      sub: 'Audit trail',            color: palette.teal,     bg: palette.stableBg },
              ].map(({ icon: Icon, label, sub, color, bg }) => (
                <button key={label} className="flex items-center gap-4 p-4 rounded-xl border hover:shadow-md transition-all text-left"
                  style={{ backgroundColor: bg, borderColor: palette.border }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white shadow-sm shrink-0">
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm">{label}</div>
                    <div className="text-[11px] text-slate-500">{sub}</div>
                  </div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: color + '22' }}>
                    <span className="text-[10px] font-black" style={{ color }}>›</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;