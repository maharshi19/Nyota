import React from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface RiskTrendPoint {
  date: string;
  riskScore: number;
  vitalsPressure: number;
  interventions: string[];
}

interface RiskTrajectoryProps {
  patientName: string;
  currentRisk: number;
  riskTier: string;
  data: RiskTrendPoint[];
}

const RiskTrajectory: React.FC<RiskTrajectoryProps> = ({ patientName, currentRisk, riskTier, data }) => {
  // Calculate trend
  const calculateTrend = () => {
    if (data.length < 2) return { direction: 'stable', change: 0 };
    const recentAvg = data.slice(-3).reduce((sum, p) => sum + p.riskScore, 0) / Math.min(3, data.length);
    const olderAvg = data.slice(0, 3).reduce((sum, p) => sum + p.riskScore, 0) / Math.min(3, data.length);
    const change = recentAvg - olderAvg;
    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      change: Math.abs(Math.round(change))
    };
  };

  const trend = calculateTrend();
  const riskThresholds = {
    low: 25,
    medium: 50,
    high: 75,
    critical: 100
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'increasing': return 'text-red-600';
      case 'decreasing': return 'text-green-600';
      default: return 'text-yellow-600';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing': return <TrendingUp className="w-5 h-5" />;
      case 'decreasing': return <TrendingDown className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Risk Trajectory</h2>
          <p className="text-sm text-slate-600">{patientName} - Last 14 days</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          trend.direction === 'increasing' ? 'bg-red-50' :
          trend.direction === 'decreasing' ? 'bg-green-50' :
          'bg-yellow-50'
        }`}>
          <div className={getTrendColor(trend.direction)}>
            {getTrendIcon(trend.direction)}
          </div>
          <div>
            <p className={`text-sm font-bold ${getTrendColor(trend.direction)}`}>
              {trend.direction === 'increasing' ? 'Increasing' :
               trend.direction === 'decreasing' ? 'Improving' : 'Stable'}
            </p>
            <p className="text-xs text-slate-600">±{trend.change}% change</p>
          </div>
        </div>
      </div>

      {/* Current Status Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 font-medium mb-1">Current Risk</p>
          <p className="text-2xl font-bold text-slate-900">{currentRisk}%</p>
          <p className="text-xs text-slate-500 mt-1">{riskTier} Risk</p>
        </div>
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200">
          <p className="text-xs text-teal-600 font-medium mb-1">7-Day Avg</p>
          <p className="text-2xl font-bold text-teal-900">
            {Math.round(data.slice(-7).reduce((sum, p) => sum + p.riskScore, 0) / Math.min(7, data.length))}%
          </p>
          <p className="text-xs text-teal-600 mt-1">Last week</p>
        </div>
        <div className="bg-gradient-to-br from-teal-50 to-emerald-100 p-4 rounded-lg border border-teal-200">
          <p className="text-xs text-teal-700 font-medium mb-1">Trajectory</p>
          <p className={`text-2xl font-bold ${
            trend.direction === 'increasing' ? 'text-red-600' :
            trend.direction === 'decreasing' ? 'text-green-600' :
            'text-yellow-600'
          }`}>
            {trend.change}%
          </p>
          <p className="text-xs text-teal-700 mt-1">vs baseline</p>
        </div>
      </div>

      {/* Risk Chart with Thresholds */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Risk Score Trend</h3>
        <div className="h-64 bg-slate-50 rounded-lg p-2 border border-slate-200">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3a8c81" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3a8c81" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              {/* Risk threshold lines */}
              <ReferenceLine y={riskThresholds.medium} stroke="#f59e0b" strokeDasharray="5 5" opacity={0.5} />
              <ReferenceLine y={riskThresholds.high} stroke="#ef4444" strokeDasharray="5 5" opacity={0.5} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#f1f5f9'
                }}
                formatter={(value: number) => [`${value}%`, 'Risk Score']}
              />
              <Area
                type="monotone"
                dataKey="riskScore"
                stroke="#3a8c81"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRisk)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk Zones Legend */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Risk Zones</h3>
        <div className="grid grid-cols-4 gap-2">
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-xs font-medium text-green-900">Low</p>
            <p className="text-xs text-green-700">0-{riskThresholds.low}%</p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <p className="text-xs font-medium text-yellow-900">Medium</p>
            <p className="text-xs text-yellow-700">{riskThresholds.medium}-{riskThresholds.high}%</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <p className="text-xs font-medium text-orange-900">High</p>
            <p className="text-xs text-orange-700">{riskThresholds.high}-{riskThresholds.critical}%</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs font-medium text-red-900">Critical</p>
            <p className="text-xs text-red-700">{riskThresholds.critical}%+</p>
          </div>
        </div>
      </div>

      {/* Interventions Timeline */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Interventions</h3>
        <div className="space-y-2">
          {data.filter(p => p.interventions.length > 0).reverse().slice(0, 5).map((point, idx) => (
            <div key={idx} className="flex items-start gap-3 p-2 bg-slate-50 rounded border border-slate-200">
              <div className="w-2 h-2 mt-2 rounded-full bg-teal-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-900 font-medium">{point.date}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {point.interventions.map((int, i) => (
                    <span key={i} className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded">
                      {int}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Section */}
      {trend.direction === 'increasing' && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-900">Risk Increasing</p>
            <p className="text-sm text-red-700 mt-1">
              Patient's risk score has increased {trend.change}% in the last 7 days. Consider escalating intervention protocols.
            </p>
          </div>
        </div>
      )}

      {trend.direction === 'decreasing' && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
          <TrendingDown className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-900">Risk Decreasing</p>
            <p className="text-sm text-green-700 mt-1">
              Positive trend! Patient's risk score has improved {trend.change}% in the last 7 days. Continue current interventions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskTrajectory;
