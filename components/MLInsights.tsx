import React, { useState, useEffect } from 'react';
import { PatientCase } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import {
  Brain, TrendingUp, AlertTriangle, Shield, Activity,
  Thermometer, Wind, MapPin, Heart, Zap
} from 'lucide-react';

let cachedModelInfo: any = null;
let cachedFeatureImportance: any[] | null = null;
const predictionCache = new Map<string, any>();

const getSystolicBloodPressure = (vitals?: string): number => {
  const match = vitals?.match(/BP\s*(\d{2,3})\/(\d{2,3})/i);
  return match ? Number(match[1]) : 120;
};

const getPredictionCacheKey = (patientData: PatientCase): string => {
  return JSON.stringify({
    patientId: patientData.patientId || patientData.ssn || 'unknown',
    vitals: patientData.vitals || '',
    heatIndex: patientData.environmental?.heatIndex || 50,
  });
};

interface MLInsightsProps {
  patientData: PatientCase;
}

const MLInsights: React.FC<MLInsightsProps> = ({ patientData }) => {
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [featureImportance, setFeatureImportance] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadMLData(controller.signal);
    return () => controller.abort();
  }, [patientData.vitals, patientData.environmental?.heatIndex, patientData.patientId, patientData.ssn]);

  const loadMLData = async (signal: AbortSignal) => {
    const predictionKey = getPredictionCacheKey(patientData);
    const cachedPrediction = predictionCache.get(predictionKey);
    const hasCachedStaticData = !!cachedModelInfo && !!cachedFeatureImportance;

    if (cachedModelInfo) {
      setModelInfo(cachedModelInfo);
    }

    if (cachedFeatureImportance) {
      setFeatureImportance(cachedFeatureImportance);
    }

    if (cachedPrediction) {
      setPrediction(cachedPrediction);
    }

    setLoading(!hasCachedStaticData || !cachedPrediction);

    try {
      const staticRequests: Promise<void>[] = [];

      if (!cachedModelInfo) {
        staticRequests.push(
          fetch('/api/ml/model-info', { signal }).then(async (modelRes) => {
            if (modelRes.ok) {
              const modelData = await modelRes.json();
              cachedModelInfo = modelData;
              setModelInfo(modelData);
            }
          })
        );
      }

      if (!cachedFeatureImportance) {
        staticRequests.push(
          fetch('/api/ml/feature-importance', { signal }).then(async (featuresRes) => {
            if (featuresRes.ok) {
              const featuresData = await featuresRes.json();
              cachedFeatureImportance = featuresData.features || [];
              setFeatureImportance(cachedFeatureImportance);
            }
          })
        );
      }

      if (staticRequests.length) {
        await Promise.all(staticRequests);
      }

      if (!cachedPrediction) {
        const predictionRes = await fetch('/api/ml/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            features: {
              sbp: getSystolicBloodPressure(patientData.vitals),
              heat_island_index: patientData.environmental?.heatIndex || 50,
              map: 90,
              pulse_pressure: 40,
            }
          })
        });

        if (predictionRes.ok) {
          const predData = await predictionRes.json();
          predictionCache.set(predictionKey, predData);
          setPrediction(predData);
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error loading ML data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin mb-6"></div>
        <h3 className="text-lg font-bold text-slate-700">Loading ML Insights...</h3>
        <p className="text-sm text-slate-500 mt-2">Analyzing patient data with AI models</p>
      </div>
    );
  }

  const riskColors = {
    'Low': '#10b981',
    'Medium': '#f59e0b',
    'High': '#f97316',
    'Critical': '#ef4444'
  };

  const performanceData = modelInfo ? [
    { name: 'Precision', value: 0.166, target: 0.15 },
    { name: 'Recall', value: 0.738, target: 0.6 },
    { name: 'AUC-ROC', value: 0.651, target: 0.7 },
    { name: 'AP Score', value: 0.244, target: 0.25 }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 p-6 rounded-xl border border-teal-100">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-8 h-8 text-teal-600" />
          <div>
            <h2 className="text-xl font-bold text-slate-800">ML Model Predictions</h2>
            <p className="text-sm text-slate-600">AI-powered risk assessment for 72-hour adverse events</p>
          </div>
        </div>

        {prediction && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-teal-600" />
                <span className="text-sm font-bold text-slate-700">Risk Probability</span>
              </div>
              <div className="text-2xl font-black" style={{ color: riskColors[prediction.riskTier] }}>
                {prediction.probability}%
              </div>
              <div className="text-xs text-slate-500 mt-1">72-hour event likelihood</div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-teal-600" />
                <span className="text-sm font-bold text-slate-700">Risk Tier</span>
              </div>
              <div className="text-2xl font-black" style={{ color: riskColors[prediction.riskTier] }}>
                {prediction.riskTier}
              </div>
              <div className="text-xs text-slate-500 mt-1">Clinical priority level</div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-700">Model Confidence</span>
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {Math.round((prediction.confidence || 0) * 100)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">Prediction reliability</div>
            </div>
          </div>
        )}
      </div>

      {/* Model Performance */}
      {modelInfo && (
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            Model Performance Metrics
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-2xl font-black text-teal-600">{modelInfo.metrics.test.ap.toFixed(3)}</div>
              <div className="text-xs font-bold text-slate-600">AUC-PR</div>
              <div className="text-xs text-slate-500">Test Set</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-2xl font-black text-teal-600">{modelInfo.metrics.test.auc.toFixed(3)}</div>
              <div className="text-xs font-bold text-slate-600">AUC-ROC</div>
              <div className="text-xs text-slate-500">Test Set</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-2xl font-black text-emerald-600">{modelInfo.dataset.totalRows.toLocaleString()}</div>
              <div className="text-xs font-bold text-slate-600">Training Samples</div>
              <div className="text-xs text-slate-500">Total Records</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-2xl font-black text-rose-400">{(modelInfo.dataset.positiveRate * 100).toFixed(1)}%</div>
              <div className="text-xs font-bold text-slate-600">Event Rate</div>
              <div className="text-xs text-slate-500">72h Events</div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <XAxis dataKey="name" />
                <YAxis domain={[0, 1]} />
                <Tooltip formatter={(value: number) => [value.toFixed(3), 'Score']} />
                <Bar dataKey="value" fill="#3a8c81" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Feature Importance */}
      {featureImportance.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            Top Risk Factors
          </h3>

          <div className="space-y-3">
            {featureImportance.slice(0, 8).map((feature, index) => (
              <div key={feature.name} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-700">{feature.name.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-bold text-slate-500">{(feature.importance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full"
                      style={{ width: `${feature.importance * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Distribution */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Risk Tier Distribution
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3">Population Risk Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Low Risk (0-12%)</span>
                <span className="text-sm font-bold text-emerald-600">68.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Medium Risk (12-28%)</span>
                <span className="text-sm font-bold text-amber-600">23.1%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">High Risk (28-50%)</span>
                <span className="text-sm font-bold text-orange-600">7.3%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Critical Risk (50%+)</span>
                <span className="text-sm font-bold text-rose-400">1.4%</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3">Clinical Thresholds</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Alert Threshold</span>
                <span className="text-sm font-bold text-teal-600">8.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Tier 2 (Monitor)</span>
                <span className="text-sm font-bold text-amber-600">11.8%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Tier 3 (Intervene)</span>
                <span className="text-sm font-bold text-orange-600">19.5%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Tier 4 (Critical)</span>
                <span className="text-sm font-bold text-rose-400">28.1%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLInsights;