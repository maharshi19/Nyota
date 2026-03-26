import React, { useState, useEffect } from 'react';
import { Settings, Server, Wifi, Users, MapPin, Save, RefreshCw, Plus, Edit, Trash2 } from 'lucide-react';
import { dashboardTheme } from '../utils/dashboardTheme';

interface TowerConfig {
  id: string;
  name: string;
  type: 'tower' | 'hub' | 'endpoint';
  location: string;
  coordinates: { lat: number; lng: number };
  coverage: number; // radius in km
  capacity: number;
  status: 'active' | 'inactive' | 'maintenance';
  lastUpdated: Date;
}

interface NetworkSettings {
  autoFailover: boolean;
  loadBalancing: boolean;
  encryptionLevel: 'basic' | 'standard' | 'military';
  backupFrequency: number; // hours
  alertThresholds: {
    latency: number;
    connections: number;
    errors: number;
  };
}

const TowerConfigView: React.FC = () => {
  const palette = dashboardTheme;
  const [towers, setTowers] = useState<TowerConfig[]>([]);
  const [networkSettings, setNetworkSettings] = useState<NetworkSettings>({
    autoFailover: true,
    loadBalancing: true,
    encryptionLevel: 'standard',
    backupFrequency: 24,
    alertThresholds: {
      latency: 100,
      connections: 10,
      errors: 5
    }
  });
  const [selectedTower, setSelectedTower] = useState<TowerConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    // Load mock tower configurations
    const mockTowers: TowerConfig[] = [
      {
        id: 'tower-1',
        name: 'Downtown Care Tower',
        type: 'tower',
        location: '123 Main St, Downtown',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        coverage: 5,
        capacity: 100,
        status: 'active',
        lastUpdated: new Date(Date.now() - 3600000)
      },
      {
        id: 'hub-1',
        name: 'Regional Coordination Hub',
        type: 'hub',
        location: '456 Health Ave, Midtown',
        coordinates: { lat: 40.7589, lng: -73.9851 },
        coverage: 15,
        capacity: 500,
        status: 'active',
        lastUpdated: new Date(Date.now() - 7200000)
      },
      {
        id: 'endpoint-1',
        name: 'Mobile Care Unit A',
        type: 'endpoint',
        location: 'Mobile - Sector 7',
        coordinates: { lat: 40.7505, lng: -73.9934 },
        coverage: 2,
        capacity: 5,
        status: 'active',
        lastUpdated: new Date(Date.now() - 1800000)
      },
      {
        id: 'tower-2',
        name: 'Suburban Care Tower',
        type: 'tower',
        location: '789 Wellness Blvd, Suburb',
        coordinates: { lat: 40.6782, lng: -73.9442 },
        coverage: 8,
        capacity: 150,
        status: 'maintenance',
        lastUpdated: new Date(Date.now() - 86400000)
      }
    ];
    setTowers(mockTowers);
  }, []);

  const handleSaveSettings = () => {
    // In a real app, this would save to backend
    console.log('Saving network settings:', networkSettings);
    // Show success message
  };

  const handleAddTower = () => {
    const newTower: TowerConfig = {
      id: `tower-${Date.now()}`,
      name: 'New Tower',
      type: 'tower',
      location: 'Location TBD',
      coordinates: { lat: 0, lng: 0 },
      coverage: 5,
      capacity: 50,
      status: 'inactive',
      lastUpdated: new Date()
    };
    setTowers([...towers, newTower]);
    setSelectedTower(newTower);
    setIsEditing(true);
    setShowAddForm(false);
  };

  const handleUpdateTower = (updatedTower: TowerConfig) => {
    setTowers(towers.map(t => t.id === updatedTower.id ? updatedTower : t));
    setIsEditing(false);
    setSelectedTower(null);
  };

  const handleDeleteTower = (towerId: string) => {
    setTowers(towers.filter(t => t.id !== towerId));
    if (selectedTower?.id === towerId) {
      setSelectedTower(null);
      setIsEditing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tower': return <Server className="w-4 h-4" />;
      case 'hub': return <Wifi className="w-4 h-4" />;
      case 'endpoint': return <Users className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  return (
    <div
      className="flex-1 p-6 overflow-y-auto"
      style={{ background: `linear-gradient(170deg, ${palette.surface} 0%, #f1ebe0 52%, #edf3ef 100%)` }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-teal-600" />
                Tower Configuration
              </h1>
              <p className="text-slate-600 mt-1">Manage community care network infrastructure</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: palette.teal }}
            >
              <Plus className="w-4 h-4" />
              Add Tower
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tower List */}
          <div className="lg:col-span-2">
            <div className="rounded-lg shadow-sm border" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Network Towers & Hubs</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {towers.map((tower) => (
                  <div
                    key={tower.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedTower?.id === tower.id ? 'border-l-4' : ''
                    }`}
                    style={{
                      backgroundColor: selectedTower?.id === tower.id ? '#edf4f1' : 'transparent',
                      borderLeftColor: selectedTower?.id === tower.id ? palette.teal : 'transparent',
                    }}
                    onClick={() => setSelectedTower(tower)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(tower.type)}
                        <div>
                          <h3 className="font-medium text-slate-900">{tower.name}</h3>
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {tower.location}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(tower.status)}`}>
                          {tower.status}
                        </div>
                        <div className="text-right text-sm text-slate-600">
                          <div>{tower.capacity} capacity</div>
                          <div>{tower.coverage}km coverage</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Network Settings */}
            <div className="rounded-lg shadow-sm border p-6" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Network Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Auto Failover</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={networkSettings.autoFailover}
                      onChange={(e) => setNetworkSettings({...networkSettings, autoFailover: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Load Balancing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={networkSettings.loadBalancing}
                      onChange={(e) => setNetworkSettings({...networkSettings, loadBalancing: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">Encryption Level</label>
                  <select
                    value={networkSettings.encryptionLevel}
                    onChange={(e) => setNetworkSettings({...networkSettings, encryptionLevel: e.target.value as any})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="military">Military Grade</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">Backup Frequency (hours)</label>
                  <input
                    type="number"
                    value={networkSettings.backupFrequency}
                    onChange={(e) => setNetworkSettings({...networkSettings, backupFrequency: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    min="1"
                    max="168"
                  />
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
                  style={{ backgroundColor: palette.teal }}
                >
                  <Save className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </div>

            {/* Tower Details/Edit */}
            {selectedTower && (
              <div className="rounded-lg shadow-sm border p-6" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {isEditing ? 'Edit Tower' : 'Tower Details'}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="p-2 text-slate-600 transition-colors"
                      style={{ color: isEditing ? palette.teal : undefined }}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTower(selectedTower.id)}
                      className="p-2 text-slate-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={selectedTower.name}
                        onChange={(e) => setSelectedTower({...selectedTower, name: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Type</label>
                      <select
                        value={selectedTower.type}
                        onChange={(e) => setSelectedTower({...selectedTower, type: e.target.value as any})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="tower">Tower</option>
                        <option value="hub">Hub</option>
                        <option value="endpoint">Endpoint</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Location</label>
                      <input
                        type="text"
                        value={selectedTower.location}
                        onChange={(e) => setSelectedTower({...selectedTower, location: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Coverage (km)</label>
                        <input
                          type="number"
                          value={selectedTower.coverage}
                          onChange={(e) => setSelectedTower({...selectedTower, coverage: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Capacity</label>
                        <input
                          type="number"
                          value={selectedTower.capacity}
                          onChange={(e) => setSelectedTower({...selectedTower, capacity: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpdateTower(selectedTower)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
                      style={{ backgroundColor: palette.teal }}
                    >
                      <Save className="w-4 h-4" />
                      Update Tower
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Type:</span>
                      <span className="font-medium capitalize">{selectedTower.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(selectedTower.status)}`}>
                        {selectedTower.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Coverage:</span>
                      <span className="font-medium">{selectedTower.coverage} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Capacity:</span>
                      <span className="font-medium">{selectedTower.capacity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Last Updated:</span>
                      <span className="font-medium text-sm">{selectedTower.lastUpdated.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Tower Form */}
            {showAddForm && (
              <div className="rounded-lg shadow-sm border p-6" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Tower</h3>
                <div className="space-y-4">
                  <button
                    onClick={handleAddTower}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
                    style={{ backgroundColor: palette.teal }}
                  >
                    <Plus className="w-4 h-4" />
                    Create Tower
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="w-full px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TowerConfigView;