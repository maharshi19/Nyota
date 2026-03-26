
export interface CareForceMember {
  id: string;
  name: string;
  role: 'CHW' | 'Doula' | 'Midwife' | 'Nurse' | 'MD' | 'Specialist';
  status: 'active' | 'available' | 'offline';
  caseload: number;
  maxCapacity: number;
  coverageArea: string[]; // Zip codes
  rating: number;
  benefitProgram: string; // e.g., "TMaH Pillar 3", "HEDIS Postpartum Surge"
  initials: string;
  color: string;
  lastActivity: string;
}

export interface CareForceActivity {
  id: string;
  memberId: string;
  memberName: string;
  action: string;
  location: string;
  timestamp: string;
}

export interface HEDISMetric {
  id: string;
  name: string;
  code: string;
  currentRate: number;
  goal: number;
  trend: number;
  status: 'on-track' | 'at-risk' | 'failing';
  numerator: number;
  denominator: number;
}

export interface HEDISGapMember {
  id: string;
  name: string;
  mrn: string;
  metric: string;
  daysRemaining: number;
  status: 'critical' | 'warning' | 'stable';
  prescriptiveAction: string;
}

export interface EnvironmentalReading {
  timestamp: string;
  airQuality: number; // AQI value
  heatIndex: number;
}

export interface SDOHReading {
  timestamp: string;
  foodStress: number; // 0-100
  transportStress: number; // 0-100
  housingStress: number; // 0-100
}

export interface CommunityCareAccess {
  midwifeAvailable: boolean;
  doulaAvailable: boolean;
  chwAssigned: boolean;
  lastVisitDate?: string;
  fieldVitals?: string;
  doulaNotes?: string;
}

export interface BirthPlan {
  painManagement: string;
  birthEnvironment: string[];
  laborSupport: string[];
  postpartumPreferences: string[];
  feedingChoice: string;
  lastUpdated: string;
}

export interface EnvironmentalData {
  airQuality: string; // AQI
  heatIndex: number;
  isHeatIsland: boolean;
  foodDesertStatus: boolean;
  transportationDesertStatus: boolean;
  maternityCareDesert: boolean;
  zipCode: string;
}

export interface PatientCase {
  patientId?: string;
  ssn?: string;
  age: string;
  gestation: string; 
  parity: string; 
  chiefComplaint: string;
  vitals: string; 
  environmentalVitalSign?: string; 
  narrative: string; 
  labs?: string; 
  socialHistory?: string;
  environmental?: EnvironmentalData;
  communityAccess?: CommunityCareAccess;
  birthPlan?: BirthPlan;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  isBirthingFriendly: boolean;
  qualityRating: number;
  tmahIntegrated: boolean;
  distance?: string;
}

export interface RiskFactor {
  factor: string;
  category: 'clinical' | 'sdoh' | 'environmental' | 'history' | 'community';
  significance: 'high' | 'medium' | 'low';
}

export interface DiagnosisItem {
  condition: string;
  likelihood: string;
  reasoning: string;
  redFlags: string[];
}

export interface Intervention {
  action: string;
  rationale: string;
  timing: 'immediate' | 'urgent' | 'routine';
}

export interface PrescriptiveAction {
  action: string;
  interventionType: 'CHW Dispatch' | 'Nursing Visit' | 'Cooling Unit' | 'Transport' | 'Clinical' | 'Doula Connection';
  cost: number;
  potentialSavings: number;
  rationale: string;
}

export interface AnalysisResult {
  safetyChecklist: SafetyCheck[];
  differentialDiagnosis: DiagnosisItem[];
  managementPlan: Intervention[];
  prescriptiveIntelligence: PrescriptiveAction[];
  biasCorrectionNote: string;
  riskScore: {
    value: number; 
    level: 'Critical' | 'Elevated' | 'Baseline';
    window: '72-hour' | 'Standard';
  };
  tmahMetrics: {
    cSectionProbability: number; // 0-100 (LRCD-AD/CH)
    sentimentScore: number; // 0-100 (MMH Screening)
    resourceStrainIndex: number; // 1-10 (HEDIS PPC)
    nicuProbability: number; // 0-100
    adminBurdenSaved: number; // hours
  };
  cognitiveContext: {
    sdohInsights: string[];
    riskFactors: RiskFactor[];
    communitySupportNote?: string;
  };
  keyLabs: LabResult[];
  environmentalHistory?: EnvironmentalReading[];
  historicalSDoH?: SDOHReading[];
}

export interface SafetyCheck {
  category: 'Hemorrhage' | 'Hypertension' | 'Sepsis' | 'Cardiovascular' | 'Embolism' | 'Mental Health';
  status: 'Critical' | 'Warning' | 'Stable' | 'Unknown';
  finding: string;
}

export interface LabResult {
  name: string;
  value: string;
  unit: string;
  flag: 'normal' | 'high' | 'low' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'MCO Case Manager' | 'Care Navigator' | 'Clinical Coordinator' | 'State Lead MCO Supervisor' | 'Admin' | 'CHW' | 'Doula' | 'Midwife' | 'MD' | 'Specialist' | 'OB/GYN Attending' | 'Charge Nurse' | 'Rotating';
  initials: string;
  color: string;
  permissions?: UserPermissions;
  department?: string;
  supervisorId?: string;
}

export interface UserPermissions {
  canViewAllData: boolean;
  canEditUsers: boolean;
  canApproveActions: boolean;
  canAccessStatewide: boolean;
  canManageTeams: boolean;
  canViewAnalytics: boolean;
}

export interface UserSession {
  user: TeamMember;
  isAuthenticated: boolean;
  sessionStart: Date;
  lastActivity: Date;
  accessLevel: 'user' | 'supervisor' | 'admin';
}

export interface Task {
  id: string;
  title: string;
  category: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  assignee?: TeamMember;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type: 'automation' | 'alert' | 'message';
}

export interface BoardItem {
  id: string;
  name: string; 
  mrn: string;
  status: string; 
  triage: string; 
  assignee?: TeamMember;
  lastVitals: string;
  caseData: PatientCase; 
  analysis?: AnalysisResult; 
  lastUpdated: string;
  updatesCount: number;
  riskRank: number;
  /* optional fields used by DashboardView computations */
  nicuCategory?: string;
  nicuProbability?: number;
  smmCondition?: string;
  ppcPre?: boolean;
  ppcPost?: boolean;
  estimatedSavings?: number;
}

export interface BoardGroup {
  id: string;
  title: string;
  color: string; 
  items: BoardItem[];
}

export type PillarType = 'mco' | 'clinical' | 'community';
