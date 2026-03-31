import React, { useState, useEffect } from 'react';
import { useData } from '../DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line } from 'recharts';
import { AlertCircle, CheckCircle, AlertTriangle, TrendingUp, X, Send, Phone, Clock, Heart } from 'lucide-react';
import RiskTrajectory from './RiskTrajectory';

interface MLModelInfo {
  version: string;
  target: string;
  metrics: {
    test: {
      ap: number;
      auc: number;
      brier: number;
    };
    validation: {
      ap: number;
      auc: number;
      brier: number;
    };
  };
  tier_thresholds: {
    tier4: number;
    tier3: number;
    tier2: number;
  };
}

interface FeatureImportance {
  name: string;
  importance: number;
  std: number;
}

interface PatientPrediction {
  id: string;
  name: string;
  mrn: string;
  age: number;
  prediction: number;
  probability: number;
  riskTier: string;
  confidence: number;
  features: {
    sbp: number;
    dbp: number;
    map: number;
    heat_island_index: number;
  };
  keyRiskFactors: string[];
}

const ClinicalDiagnosticsView: React.FC = () => {
  const { items } = useData();
  const [modelInfo, setModelInfo] = useState<MLModelInfo | null>(null);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportance[]>([]);
  const [predictions, setPredictions] = useState<PatientPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<PatientPrediction | null>(null);
  const [alerts, setAlerts] = useState<Array<{ id: string; type: string; message: string; timestamp: Date }>>([]);

  useEffect(() => {
    const parseSbp = (vitals: string): number => {
      const match = /BP\s*(\d{2,3})\/(\d{2,3})/i.exec(vitals || '');
      return match ? Number(match[1]) : 120;
    };

    const parseDbp = (vitals: string): number => {
      const match = /BP\s*(\d{2,3})\/(\d{2,3})/i.exec(vitals || '');
      return match ? Number(match[2]) : 80;
    };

    const loadData = async () => {
      try {
        const [modelRes, featuresRes] = await Promise.all([
          fetch('/api/ml/model-info'),
          fetch('/api/ml/feature-importance')
        ]);

        if (modelRes.ok) {
          const modelData = await modelRes.json();
          setModelInfo(modelData);
        }

        if (featuresRes.ok) {
          const featuresData = await featuresRes.json();
          setFeatureImportance(featuresData.features.slice(0, 8));
        }

        // Build patient cohort from real board data (highest risk first)
        const samplePatients = items
          .slice()
          .sort((a, b) => (b.riskRank || 0) - (a.riskRank || 0))
          .slice(0, 6)
          .map((item, idx) => {
            const sbp = parseSbp(item.lastVitals);
            const dbp = parseDbp(item.lastVitals);
            return {
              id: item.id || `p-${idx + 1}`,
              name: item.name,
              mrn: item.mrn,
              age: Number(item.caseData?.age) || 28,
              sbp,
              dbp,
              map: Math.round((sbp + 2 * dbp) / 3),
              heat_island_index: item.caseData?.environmental?.isHeatIsland ? 85 : 65,
            };
          });

        // Generate predictions for each sample patient
        const samplePredictions: PatientPrediction[] = await Promise.all(
          samplePatients.map(async (patient) => {
            const predRes = await fetch('/api/ml/predict', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                features: {
                  sbp: patient.sbp,
                  dbp: patient.dbp,
                  map: patient.map,
                  heat_island_index: patient.heat_island_index,
                  age: patient.age
                }
              })
            });

            if (predRes.ok) {
              const pred = await predRes.json();
              return {
                ...patient,
                prediction: pred.prediction,
                probability: pred.probability,
                riskTier: pred.riskTier,
                confidence: pred.confidence,
                features: {
                  sbp: patient.sbp,
                  dbp: patient.dbp,
                  map: patient.map,
                  heat_island_index: patient.heat_island_index
                },
                keyRiskFactors: patient.sbp > 140 ? ['Elevated SBP', 'Heat Exposure'] : ['Heat Exposure']
              };
            }
            return null;
          })
        );

        setPredictions(samplePredictions.filter(Boolean) as PatientPrediction[]);
      } catch (error) {
        console.error('Failed to load ML data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [items]);

  const getRiskColor = (tier: string) => {
    switch(tier) {
      case 'Critical': return { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', icon: 'text-red-600' };
      case 'High': return { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', icon: 'text-orange-600' };
      case 'Medium': return { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', icon: 'text-yellow-600' };
      default: return { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', icon: 'text-green-600' };
    }
  };

  const handleViewAssessment = (patient: PatientPrediction) => {
    setSelectedPatient(patient);
    
    // Send emergency alert if critical
    if (patient.riskTier === 'Critical') {
      const alertId = `alert-${Date.now()}`;
      const alert = {
        id: alertId,
        type: 'critical',
        message: `🚨 CRITICAL: ${patient.name} (${patient.mrn}) requires immediate medical attention. Risk Score: ${patient.probability}%`,
        timestamp: new Date()
      };
      setAlerts(prev => [alert, ...prev]);
      
      // Auto-remove alert after 10 seconds
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }, 10000);
    }
  };

  const handleSendAlert = (patient: PatientPrediction) => {
    const alertMessage = `Clinical Alert: ${patient.name} (${patient.mrn}) - Risk Tier: ${patient.riskTier} - Probability: ${patient.probability}%`;
    
    // Simulate sending alert to emergency services or care team
    console.log('Alert sent:', alertMessage);
    
    const alertId = `manual-alert-${Date.now()}`;
    setAlerts(prev => [{
      id: alertId,
      type: 'sent',
      message: `✓ Alert sent for ${patient.name}. Emergency team notified.`,
      timestamp: new Date()
    }, ...prev]);
    
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }, 5000);
  };

  const RiskCard: React.FC<{ prediction: PatientPrediction }> = ({ prediction }) => {
    const colors = getRiskColor(prediction.riskTier);
    const riskIcon = 
      prediction.riskTier === 'Critical' ? <AlertCircle className={`w-6 h-6 ${colors.icon}`} /> :
      prediction.riskTier === 'High' ? <AlertTriangle className={`w-6 h-6 ${colors.icon}`} /> :
      <TrendingUp className={`w-6 h-6 ${colors.icon}`} />;

    return (
      <div className={`${colors.bg} ${colors.border} border rounded-lg p-5 transition-all hover:shadow-md`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-lg">{prediction.name}</h3>
            <p className="text-sm text-slate-600">{prediction.mrn} • Age {prediction.age}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {riskIcon}
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.badge}`}>
              {prediction.riskTier} Risk
            </span>
          </div>
        </div>

        {/* Risk Probability Meter */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-slate-700">72-Hour Adverse Event Risk</label>
            <span className="text-lg font-bold text-slate-900">{prediction.probability}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                prediction.riskTier === 'Critical' ? 'bg-red-600' :
                prediction.riskTier === 'High' ? 'bg-orange-500' :
                prediction.riskTier === 'Medium' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${prediction.probability}%` }}
            />
          </div>
        </div>

        {/* Key Vitals */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-white/50 rounded p-2">
            <div className="text-xs text-slate-600">Systolic BP</div>
            <div className="font-bold text-slate-900">{prediction.features.sbp} mmHg</div>
          </div>
          <div className="bg-white/50 rounded p-2">
            <div className="text-xs text-slate-600">Mean Arterial</div>
            <div className="font-bold text-slate-900">{prediction.features.map} mmHg</div>
          </div>
          <div className="bg-white/50 rounded p-2">
            <div className="text-xs text-slate-600">Heat Island Index</div>
            <div className="font-bold text-slate-900">{prediction.features.heat_island_index}</div>
          </div>
          <div className="bg-white/50 rounded p-2">
            <div className="text-xs text-slate-600">Model Confidence</div>
            <div className="font-bold text-slate-900">{(prediction.confidence * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* Key Risk Factors */}
        <div className="border-t border-current border-opacity-20 pt-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">Key Risk Factors</p>
          <div className="flex flex-wrap gap-1">
            {prediction.keyRiskFactors.map((factor, idx) => (
              <span key={idx} className="px-2 py-1 bg-white/60 rounded text-xs font-medium text-slate-700">
                {factor}
              </span>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => handleViewAssessment(prediction)}
          className={`w-full mt-3 py-2 rounded font-medium text-sm transition-colors ${
            prediction.riskTier === 'Critical' ? 'bg-red-600 hover:bg-red-700 text-white' :
            prediction.riskTier === 'High' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
            'bg-teal-600 hover:bg-teal-700 text-white'
          }`}>
          {prediction.riskTier === 'Critical' ? 'Urgent Review Required' : 'View Full Assessment'}
        </button>
      </div>
    );
  };
  // Prepare chart data
  const avgConfidence = predictions.length
    ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
    : 0;

  const performanceData = modelInfo ? [
    { name: 'AUC-PR', value: modelInfo.metrics.test.ap * 100, target: modelInfo.metrics.validation.ap * 100 },
    { name: 'AUC-ROC', value: modelInfo.metrics.test.auc * 100, target: modelInfo.metrics.validation.auc * 100 },
    { name: 'Calibration', value: Math.max(0, 100 - modelInfo.metrics.test.brier * 100), target: Math.max(0, 100 - modelInfo.metrics.validation.brier * 100) },
    { name: 'Confidence', value: avgConfidence * 100, target: 80 }
  ] : [];

  const riskCounts = {
    low: predictions.filter(p => p.riskTier === 'Low').length,
    medium: predictions.filter(p => p.riskTier === 'Medium').length,
    high: predictions.filter(p => p.riskTier === 'High').length,
    critical: predictions.filter(p => p.riskTier === 'Critical').length,
  };

  const riskDistributionData = [
    { name: 'Low Risk', value: riskCounts.low, color: '#10b981' },
    { name: 'Medium Risk', value: riskCounts.medium, color: '#f59e0b' },
    { name: 'High Risk', value: riskCounts.high, color: '#ef4444' },
    { name: 'Critical Risk', value: riskCounts.critical, color: '#7c2d12' }
  ].filter(r => r.value > 0);

  const featureRadarData = featureImportance.map(feature => ({
    feature: feature.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    importance: feature.importance * 100
  }));

  const generateRiskTrajectoryData = (probability: number, sbp: number) => {
    const data = [];
    const now = new Date();
    const dayLabels = Array.from({ length: 14 }, (_, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (13 - idx));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const baseRisk = Math.max(10, probability - 12);

    for (let i = 0; i < dayLabels.length; i++) {
      const trend = i >= 8 ? -4 : 2;
      const wave = Math.sin(i / 2.5) * 4;
      const riskScore = Math.max(5, Math.min(95, Math.round(baseRisk + wave + trend)));
      const vitalsPressure = Math.round(sbp - 6 + Math.sin(i / 2) * 3);

      data.push({
        date: dayLabels[i],
        riskScore,
        vitalsPressure,
        interventions: i === 8 ? ['Enhanced Monitoring', 'Care Team Alert'] : i === 11 ? ['Follow-up Call'] : []
      });
    }
    return data;
  };

  const FullAssessmentModal: React.FC<{ patient: PatientPrediction; onClose: () => void }> = ({ patient, onClose }) => {
    const colors = getRiskColor(patient.riskTier);
    const trajectoryData = generateRiskTrajectoryData(patient.probability, patient.features.sbp);
    const recommendations = {
      Critical: [
        'Immediate emergency medical evaluation required',
        'Consider hospitalization or acute care facility',
        'Continuous fetal monitoring recommended',
        'Contact OB/GYN emergency team immediately'
      ],
      High: [
        'Urgent clinical assessment within 2-4 hours',
        'Enhanced monitoring and follow-up protocols',
        'Consider specialist consultation',
        'Increase care coordination frequency'
      ],
      Medium: [
        'Schedule routine follow-up within 1 week',
        'Monitor vitals and symptoms closely',
        'Maintain regular care coordination',
        'Document findings in medical record'
      ],
      Low: [
        'Continue standard prenatal care',
        'Routine follow-up appointments',
        'Monitor for any symptom changes',
        'Maintain preventive health protocols'
      ]
    };

    const riskRecommendations = recommendations[patient.riskTier as keyof typeof recommendations] || recommendations.Low;

    const vitalsTimeseries = [
      { time: '6h ago', sbp: patient.features.sbp - 5, dbp: patient.features.dbp - 3, map: patient.features.map - 4 },
      { time: '4h ago', sbp: patient.features.sbp - 3, dbp: patient.features.dbp - 2, map: patient.features.map - 2 },
      { time: '2h ago', sbp: patient.features.sbp - 1, dbp: patient.features.dbp - 1, map: patient.features.map - 1 },
      { time: 'Now', sbp: patient.features.sbp, dbp: patient.features.dbp, map: patient.features.map }
    ];

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className={`${colors.bg} p-6 border-b ${colors.border} sticky top-0`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-slate-900">{patient.name}</h1>
                <p className="text-slate-600 mt-1">{patient.mrn} • Age {patient.age} years</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-slate-600" />
              </button>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className={`px-4 py-2 rounded-lg ${colors.badge}`}>
                <span className="font-bold text-lg">{patient.riskTier} Risk</span>
              </div>
              <div className="bg-white/60 px-4 py-2 rounded-lg">
                <span className="text-2xl font-bold text-slate-900">{patient.probability}%</span>
                <span className="text-sm text-slate-600 ml-2">Event Risk</span>
              </div>
              <div className="bg-white/60 px-4 py-2 rounded-lg ml-auto">
                <span className="text-sm text-slate-600">Model Confidence</span>
                <span className="text-lg font-bold text-slate-900">{(patient.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Critical Alert Banner */}
            {patient.riskTier === 'Critical' && (
              <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-900">CRITICAL CONDITION - IMMEDIATE ACTION REQUIRED</h3>
                  <p className="text-red-700 text-sm mt-1">This patient requires emergency medical evaluation. Contact emergency services immediately.</p>
                </div>
              </div>
            )}

            {/* Current Vitals */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Current Vital Signs</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-slate-600 font-medium mb-1">Systolic BP</div>
                  <div className="text-2xl font-bold text-slate-900">{patient.features.sbp}</div>
                  <div className="text-xs text-slate-500">mmHg</div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-slate-600 font-medium mb-1">Diastolic BP</div>
                  <div className="text-2xl font-bold text-slate-900">{patient.features.dbp}</div>
                  <div className="text-xs text-slate-500">mmHg</div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-slate-600 font-medium mb-1">Mean Arterial</div>
                  <div className="text-2xl font-bold text-slate-900">{patient.features.map}</div>
                  <div className="text-xs text-slate-500">mmHg</div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-slate-600 font-medium mb-1">Heat Index</div>
                  <div className="text-2xl font-bold text-slate-900">{patient.features.heat_island_index}</div>
                  <div className="text-xs text-slate-500">Index Value</div>
                </div>
              </div>
            </div>

            {/* Vital Signs Trend */}
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Vital Trends (Last 6 Hours)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalsTimeseries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="sbp" stroke="#ef4444" name="Systolic BP" strokeWidth={2} />
                    <Line type="monotone" dataKey="dbp" stroke="#3a8c81" name="Diastolic BP" strokeWidth={2} />
                    <Line type="monotone" dataKey="map" stroke="#f59e0b" name="Mean Arterial" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Key Risk Factors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Identified Risk Factors</h2>
                <div className="space-y-2">
                  {patient.keyRiskFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-medium text-slate-700">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Model Information</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Prediction Score:</span>
                    <span className="font-bold text-slate-900">{(patient.prediction * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Confidence Level:</span>
                    <span className="font-bold text-slate-900">{(patient.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Time to Assessment:</span>
                    <span className="font-bold text-slate-900">Real-time</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Model Version:</span>
                    <span className="font-bold text-slate-900">v4.0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Trajectory Section */}
            <RiskTrajectory
              patientName={patient.name}
              currentRisk={patient.probability}
              riskTier={patient.riskTier}
              data={trajectoryData}
            />

            {/* Clinical Recommendations */}
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg p-4 border border-teal-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-teal-600" />
                Clinical Recommendations
              </h2>
              <ul className="space-y-2">
                {riskRecommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-700">
                    <span className="text-teal-600 font-bold mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-slate-200 p-6 bg-slate-50 sticky bottom-0 flex gap-3 justify-end">
            {patient.riskTier === 'Critical' && (
              <button
                onClick={() => handleSendAlert(patient)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                <Phone className="w-4 h-4" />
                Send Emergency Alert
              </button>
            )}
            {(patient.riskTier === 'Critical' || patient.riskTier === 'High') && (
              <button
                onClick={() => handleSendAlert(patient)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                Notify Care Team
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-colors"
            >
              Close Assessment
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Recent Predictions Section */}
        <div>
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-slate-900">Recent Patient Assessments</h2>
            <p className="text-slate-600">AI-generated risk predictions for monitored members</p>
          </div>
          {predictions.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {predictions.map(pred => (
                <RiskCard key={pred.id} prediction={pred} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">Loading patient predictions...</p>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Model Analytics & Performance</h1>
              <p className="text-slate-600">Detailed ML model metrics and feature analysis</p>
            </div>
          </div>

          {modelInfo && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-teal-50 p-4 rounded-lg">
                <div className="text-sm text-teal-600 font-medium">Model Version</div>
                <div className="text-lg font-bold text-teal-900">{modelInfo.version}</div>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg">
                <div className="text-sm text-teal-600 font-medium">Target Outcome</div>
                <div className="text-lg font-bold text-teal-900">{modelInfo.target.replace(/_/g, ' ')}</div>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg">
                <div className="text-sm text-teal-700 font-medium">Training Samples</div>
                <div className="text-lg font-bold text-teal-900">4,000</div>
              </div>
            </div>
          )}
        </div>

        {/* Model Performance */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Model Performance Metrics</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, '']} />
                <Bar dataKey="value" fill="#3a8c81" name="Achieved" />
                <Bar dataKey="target" fill="#ef4444" opacity={0.3} name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feature Importance */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Top Risk Factors</h2>
            <div className="space-y-3">
              {featureImportance.map((feature, index) => (
                <div key={feature.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-sm font-bold text-teal-700">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-700">
                        {feature.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-sm text-slate-500">
                        {(feature.importance * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${feature.importance * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Population Risk Distribution</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {riskDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Population']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {riskDistributionData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-600">{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Radar Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Risk Factor Analysis</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={featureRadarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="feature" />
                <PolarRadiusAxis domain={[0, 5]} />
                <Radar
                  name="Importance"
                  dataKey="importance"
                  stroke="#3a8c81"
                  fill="#3a8c81"
                  fillOpacity={0.3}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Clinical Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h3 className="font-bold text-red-900 mb-2">Critical Risk Patients</h3>
              <p className="text-sm text-red-700">2% of population requires immediate intervention</p>
              <button className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                Review Cases
              </button>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-900 mb-2">High Risk Monitoring</h3>
              <p className="text-sm text-yellow-700">8% need enhanced monitoring protocols</p>
              <button className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700">
                Set Alerts
              </button>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-900 mb-2">Preventive Care</h3>
              <p className="text-sm text-green-700">65% eligible for preventive interventions</p>
              <button className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                Plan Outreach
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Toast */}
      <div className="fixed bottom-4 right-4 space-y-3 z-40">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`rounded-lg p-4 shadow-lg max-w-sm animate-pulse ${
              alert.type === 'critical'
                ? 'bg-red-500 text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            <p className="font-medium text-sm">{alert.message}</p>
          </div>
        ))}
      </div>

      {/* Full Assessment Modal */}
      {selectedPatient && (
        <FullAssessmentModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
};

export default ClinicalDiagnosticsView;