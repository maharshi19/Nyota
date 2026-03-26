import React, { useState, useEffect } from 'react';
import { Activity, Server, Users, AlertTriangle, CheckCircle, Clock, Zap, Wifi } from 'lucide-react';
import { dashboardTheme } from '../utils/dashboardTheme';

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  unit: string;
}

interface NetworkNode {
  id: string;
  name: string;
  type: 'tower' | 'hub' | 'endpoint';
  status: 'online' | 'offline' | 'degraded';
  latency: number;
  connections: number;
}

const SystemPulseView: React.FC = () => {
  const palette = dashboardTheme;
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    // Simulate real-time system metrics
    const generateMetrics = () => {
      const newMetrics: SystemMetric[] = [
        {
          id: 'response-time',
          name: 'Avg Response Time',
          value: Math.random() * 200 + 50,
          status: 'healthy',
          trend: 'stable',
          unit: 'ms'
        },
        {
          id: 'active-users',
          name: 'Active Care Teams',
          value: Math.floor(Math.random() * 50 + 20),
          status: 'healthy',
          trend: 'up',
          unit: ''
        },
        {
          id: 'system-load',
          name: 'System Load',
          value: Math.random() * 100,
          status: Math.random() > 0.8 ? 'warning' : 'healthy',
          trend: 'stable',
          unit: '%'
        },
        {
          id: 'error-rate',
          name: 'Error Rate',
          value: Math.random() * 5,
          status: Math.random() > 0.9 ? 'critical' : 'healthy',
          trend: 'down',
          unit: '%'
        },
        {
          id: 'data-throughput',
          name: 'Data Throughput',
          value: Math.random() * 1000 + 500,
          status: 'healthy',
          trend: 'up',
          unit: 'MB/s'
        },
        {
          id: 'uptime',
          name: 'System Uptime',
          value: 99.9,
          status: 'healthy',
          trend: 'stable',
          unit: '%'
        }
      ];
      setMetrics(newMetrics);
    };

    const generateNetworkNodes = () => {
      const nodes: NetworkNode[] = [
        { id: 'tower-1', name: 'Downtown Care Tower', type: 'tower', status: 'online', latency: 12, connections: 45 },
        { id: 'tower-2', name: 'Suburban Hub', type: 'hub', status: 'online', latency: 18, connections: 32 },
        { id: 'tower-3', name: 'Rural Network', type: 'tower', status: 'degraded', latency: 45, connections: 12 },
        { id: 'endpoint-1', name: 'Mobile Care Unit A', type: 'endpoint', status: 'online', latency: 8, connections: 1 },
        { id: 'endpoint-2', name: 'Home Monitoring B', type: 'endpoint', status: 'offline', latency: 0, connections: 0 },
        { id: 'hub-1', name: 'Regional Coordination', type: 'hub', status: 'online', latency: 15, connections: 28 }
      ];
      setNetworkNodes(nodes);
    };

    generateMetrics();
    generateNetworkNodes();

    // Update every 30 seconds
    const interval = setInterval(() => {
      generateMetrics();
      generateNetworkNodes();
      setLastUpdate(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-red-600 bg-red-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online': return <CheckCircle className="w-4 h-4" />;
      case 'warning':
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'critical':
      case 'offline': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div
      className="flex-1 p-6 overflow-y-auto"
      style={{ background: `linear-gradient(170deg, ${palette.surface} 0%, #f2ece1 50%, #edf3ef 100%)` }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-6 h-6 text-teal-600" />
                System Pulse
              </h1>
              <p className="text-slate-600 mt-1">Real-time community care network monitoring</p>
            </div>
            <div className="text-sm text-slate-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* System Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {metrics.map((metric) => (
            <div key={metric.id} className="rounded-lg p-6 shadow-sm border" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-600">{metric.name}</h3>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(metric.status)}`}>
                  {getStatusIcon(metric.status)}
                  {metric.status}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {metric.unit === '%' ? `${metric.value.toFixed(1)}${metric.unit}` :
                   metric.unit === 'ms' ? `${metric.value.toFixed(0)}${metric.unit}` :
                   metric.unit === 'MB/s' ? `${metric.value.toFixed(0)}${metric.unit}` :
                   metric.value.toFixed(0)}
                </span>
                {metric.trend !== 'stable' && (
                  <span className={`text-sm ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.trend === 'up' ? '↗' : '↘'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Network Status */}
        <div className="rounded-lg shadow-sm border mb-6" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-teal-600" />
              Network Topology
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {networkNodes.map((node) => (
                <div key={node.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {node.type === 'tower' && <Server className="w-4 h-4 text-slate-400" />}
                      {node.type === 'hub' && <Zap className="w-4 h-4 text-slate-400" />}
                      {node.type === 'endpoint' && <Users className="w-4 h-4 text-slate-400" />}
                      <span className="font-medium text-slate-900">{node.name}</span>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(node.status)}`}>
                      {getStatusIcon(node.status)}
                      {node.status}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>Latency:</span>
                      <span className="font-medium">{node.latency}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connections:</span>
                      <span className="font-medium">{node.connections}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Health Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">System Health Overview</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Overall Status</span>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-medium">Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Active Alerts</span>
                <span className="font-medium text-yellow-600">2 warnings</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Network Coverage</span>
                <span className="font-medium text-green-600">98.5%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Response SLA</span>
                <span className="font-medium text-green-600">99.2%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm text-slate-900">Network node recovered</p>
                  <p className="text-xs text-slate-500">Rural Network back online • 2 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm text-slate-900">High latency detected</p>
                  <p className="text-xs text-slate-500">Suburban Hub • 15 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm text-slate-900">System maintenance completed</p>
                  <p className="text-xs text-slate-500">All towers updated • 1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPulseView;