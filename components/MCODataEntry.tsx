import React, { useState } from 'react';
import { Plus, Save, Upload, Users, Building2, ShieldAlert, Thermometer, ShoppingBasket, Bus, Zap, HeartHandshake } from 'lucide-react';

interface MCODataEntryProps {
  onDataSubmitted?: () => void;
}

interface PatientData {
  mcoId: string;
  patientId: string;
  name: string;
  age: number;
  zipCode: string;
  clinicalData: {
    sbp: number;
    dbp: number;
    hr: number;
    temp: number;
    rr: number;
    spo2: number;
    bmi: number;
    hypertension: boolean;
    diabetes: boolean;
    smmCondition: string;
    nicuProbability: number;
    nicuCategory: 'High' | 'Rising' | 'Low';
  };
  environmentalData: {
    heatIslandIndex: number;
    aqi: number;
    humidity: number;
    pollutionLevel: string;
  };
  resourceData: {
    foodDesert: boolean;
    transportationAccess: boolean;
    healthcareFacilities: number;
    communityCenters: number;
    emergencyServices: string;
    pharmacyAccess: string;
  };
  status: 'Critical' | 'Reviewing' | 'Stable';
  estimatedSavings: number;
}

const MCODataEntry: React.FC<MCODataEntryProps> = ({ onDataSubmitted }) => {
  const palette = {
    sage: '#709a8a',
    cream: '#f6f4ef',
    sand: '#e4c8a2',
    rose: '#dba6a6',
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [patientData, setPatientData] = useState<Partial<PatientData>>({
    mcoId: 'MCO_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    clinicalData: {},
    environmentalData: {},
    resourceData: {}
  });

  const steps = [
    { id: 1, title: 'Patient Info', icon: Users },
    { id: 2, title: 'Clinical Data', icon: ShieldAlert },
    { id: 3, title: 'Environmental', icon: Thermometer },
    { id: 4, title: 'Resources', icon: Building2 },
    { id: 5, title: 'Review & Submit', icon: Save }
  ];

  const handleFlatChange = (field: keyof PatientData, value: any) => {
    setPatientData(prev => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (section: keyof PatientData, field: string, value: any) => {
    setPatientData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/mco/submit-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patientData),
      });

      if (response.ok) {
        alert('Data submitted successfully!');
        setPatientData({
          mcoId: 'MCO_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          clinicalData: {},
          environmentalData: {},
          resourceData: {}
        });
        setCurrentStep(1);
        onDataSubmitted?.();
      } else {
        alert('Failed to submit data. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting data:', error);
      alert('Error submitting data. Please check your connection.');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Users className="w-12 h-12 mx-auto mb-4" style={{ color: palette.sage }} />
              <h3 className="text-xl font-bold text-slate-800">Patient Information</h3>
              <p className="text-slate-600">Enter basic patient demographics</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Patient ID</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.patientId || ''}
                  onChange={(e) => handleFlatChange('patientId', e.target.value)}
                  placeholder="Enter patient ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.name || ''}
                  onChange={(e) => handleFlatChange('name', e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.age || ''}
                  onChange={(e) => handleFlatChange('age', parseInt(e.target.value))}
                  placeholder="Enter age"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.zipCode || ''}
                  onChange={(e) => handleFlatChange('zipCode', e.target.value)}
                  placeholder="Enter ZIP code"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <ShieldAlert className="w-12 h-12 mx-auto mb-4" style={{ color: palette.rose }} />
              <h3 className="text-xl font-bold text-slate-800">Clinical Data</h3>
              <p className="text-slate-600">Enter vital signs and clinical conditions</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">SBP (mmHg)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.sbp || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'sbp', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">DBP (mmHg)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.dbp || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'dbp', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Heart Rate</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.hr || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'hr', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Temperature (°F)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.temp || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'temp', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Respiratory Rate</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.rr || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'rr', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">SpO2 (%)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.spo2 || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'spo2', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">BMI</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.bmi || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'bmi', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">SMM Condition</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.rose }}
                  value={patientData.clinicalData?.smmCondition || ''}
                  onChange={(e) => handleInputChange('clinicalData', 'smmCondition', e.target.value)}
                >
                  <option value="">Select condition</option>
                  <option value="Hypertension">Hypertension</option>
                  <option value="Diabetes">Diabetes</option>
                  <option value="Cardiac">Cardiac</option>
                  <option value="Pulmonary">Pulmonary</option>
                  <option value="None">None</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  style={{ accentColor: palette.rose }}
                  checked={patientData.clinicalData?.hypertension || false}
                  onChange={(e) => handleInputChange('clinicalData', 'hypertension', e.target.checked)}
                />
                <span className="ml-2 text-sm text-slate-700">Hypertension</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  style={{ accentColor: palette.rose }}
                  checked={patientData.clinicalData?.diabetes || false}
                  onChange={(e) => handleInputChange('clinicalData', 'diabetes', e.target.checked)}
                />
                <span className="ml-2 text-sm text-slate-700">Diabetes</span>
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Thermometer className="w-12 h-12 mx-auto mb-4" style={{ color: palette.sand }} />
              <h3 className="text-xl font-bold text-slate-800">Environmental Data</h3>
              <p className="text-slate-600">Enter environmental factors affecting the patient</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Heat Island Index</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sand }}
                  value={patientData.environmentalData?.heatIslandIndex || ''}
                  onChange={(e) => handleInputChange('environmentalData', 'heatIslandIndex', parseFloat(e.target.value))}
                  placeholder="0.0 - 1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Air Quality Index</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sand }}
                  value={patientData.environmentalData?.aqi || ''}
                  onChange={(e) => handleInputChange('environmentalData', 'aqi', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Humidity (%)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sand }}
                  value={patientData.environmentalData?.humidity || ''}
                  onChange={(e) => handleInputChange('environmentalData', 'humidity', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pollution Level</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sand }}
                  value={patientData.environmentalData?.pollutionLevel || ''}
                  onChange={(e) => handleInputChange('environmentalData', 'pollutionLevel', e.target.value)}
                >
                  <option value="">Select level</option>
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                  <option value="Severe">Severe</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: palette.sage }} />
              <h3 className="text-xl font-bold text-slate-800">Resource Access</h3>
              <p className="text-slate-600">Enter resource availability and access information</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Healthcare Facilities (within 5 miles)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.resourceData?.healthcareFacilities || ''}
                  onChange={(e) => handleInputChange('resourceData', 'healthcareFacilities', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Community Centers (within 2 miles)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.resourceData?.communityCenters || ''}
                  onChange={(e) => handleInputChange('resourceData', 'communityCenters', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Emergency Services Response (minutes)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.resourceData?.emergencyServices || ''}
                  onChange={(e) => handleInputChange('resourceData', 'emergencyServices', e.target.value)}
                  placeholder="e.g., 8-12 min"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pharmacy Access (miles)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ borderColor: palette.sand, ['--tw-ring-color' as any]: palette.sage }}
                  value={patientData.resourceData?.pharmacyAccess || ''}
                  onChange={(e) => handleInputChange('resourceData', 'pharmacyAccess', e.target.value)}
                  placeholder="e.g., 2.5 miles"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  style={{ accentColor: palette.sage }}
                  checked={patientData.resourceData?.foodDesert || false}
                  onChange={(e) => handleInputChange('resourceData', 'foodDesert', e.target.checked)}
                />
                <span className="ml-2 text-sm text-slate-700">Food Desert Area</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  style={{ accentColor: palette.sage }}
                  checked={patientData.resourceData?.transportationAccess || false}
                  onChange={(e) => handleInputChange('resourceData', 'transportationAccess', e.target.checked)}
                />
                <span className="ml-2 text-sm text-slate-700">Limited Transportation Access</span>
              </label>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Save className="w-12 h-12 mx-auto mb-4" style={{ color: palette.sage }} />
              <h3 className="text-xl font-bold text-slate-800">Review & Submit</h3>
              <p className="text-slate-600">Please review all data before submitting</p>
            </div>

            <div className="rounded-lg p-6 space-y-4" style={{ backgroundColor: palette.cream, border: `1px solid ${palette.sand}` }}>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Patient Information</h4>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>ID:</strong> {patientData.patientId}</p>
                    <p><strong>Name:</strong> {patientData.name}</p>
                    <p><strong>Age:</strong> {patientData.age}</p>
                    <p><strong>ZIP:</strong> {patientData.zipCode}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Clinical Summary</h4>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>BP:</strong> {patientData.clinicalData?.sbp}/{patientData.clinicalData?.dbp}</p>
                    <p><strong>HR:</strong> {patientData.clinicalData?.hr} bpm</p>
                    <p><strong>BMI:</strong> {patientData.clinicalData?.bmi}</p>
                    <p><strong>Conditions:</strong> {[
                      patientData.clinicalData?.hypertension && 'HTN',
                      patientData.clinicalData?.diabetes && 'DM',
                      patientData.clinicalData?.smmCondition && patientData.clinicalData.smmCondition
                    ].filter(Boolean).join(', ') || 'None'}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Environmental</h4>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>Heat Index:</strong> {patientData.environmentalData?.heatIslandIndex}</p>
                    <p><strong>AQI:</strong> {patientData.environmentalData?.aqi}</p>
                    <p><strong>Humidity:</strong> {patientData.environmentalData?.humidity}%</p>
                    <p><strong>Pollution:</strong> {patientData.environmentalData?.pollutionLevel}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Resources</h4>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>Food Desert:</strong> {patientData.resourceData?.foodDesert ? 'Yes' : 'No'}</p>
                    <p><strong>Transport:</strong> {patientData.resourceData?.transportationAccess ? 'Limited' : 'Good'}</p>
                    <p><strong>Healthcare Facilities:</strong> {patientData.resourceData?.healthcareFacilities}</p>
                    <p><strong>Emergency Response:</strong> {patientData.resourceData?.emergencyServices}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleSubmit}
                className="px-8 py-3 text-white rounded-lg hover:opacity-90 transition-colors font-semibold flex items-center gap-2"
                style={{ backgroundColor: palette.sage }}
              >
                <Save className="w-5 h-5" />
                Submit Data to Dashboard
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl border" style={{ borderColor: palette.sand }}>
      {/* Progress Steps */}
      <div className="flex justify-between mb-8">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                isCompleted
                  ? 'text-white'
                  : isActive
                  ? 'text-slate-900'
                  : 'bg-white text-slate-400'
              }`} style={{
                backgroundColor: isCompleted ? palette.sage : isActive ? palette.sand : '#ffffff',
                borderColor: palette.sand,
              }}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs mt-2 font-medium ${
                isActive ? '' : isCompleted ? '' : 'text-slate-400'
              }`} style={{ color: isActive ? '#334155' : isCompleted ? palette.sage : undefined }}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="px-6 py-2 border rounded-lg text-slate-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: palette.sand, backgroundColor: palette.cream }}
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
          disabled={currentStep === 5}
          className="px-6 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: palette.sage }}
        >
          {currentStep === 5 ? 'Submit' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export default MCODataEntry;