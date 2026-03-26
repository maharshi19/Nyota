import React, { useEffect, useMemo, useState } from 'react';
import { Hospital } from '../types';
import { 
  Building2, 
  MapPin, 
  Search, 
  Star, 
  CheckCircle2, 
  Globe, 
  Info, 
  Filter, 
  Navigation,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { dashboardTheme } from '../utils/dashboardTheme';
import { searchBirthingFriendlySites } from '../services/gemini';

const MOCK_HOSPITALS: Hospital[] = [
  { id: 'h1', name: 'University Medical Center - Maternal Pavilion', address: '123 Care Way', city: 'Greenville', state: 'MS', zip: '38722', isBirthingFriendly: true, qualityRating: 4.8, tmahIntegrated: true, distance: '2.4 mi' },
  { id: 'h2', name: 'Saint Francis Women’s Hospital', address: '55 Hope St', city: 'Leland', state: 'MS', zip: '38721', isBirthingFriendly: true, qualityRating: 4.5, tmahIntegrated: true, distance: '5.1 mi' },
  { id: 'h3', name: 'Valley General Hospital', address: '89 Main Ave', city: 'Greenville', state: 'MS', zip: '38722', isBirthingFriendly: false, qualityRating: 3.2, tmahIntegrated: false, distance: '1.2 mi' },
  { id: 'h4', name: 'Central Health Partners', address: '200 Sky Dr', city: 'Greenville', state: 'MS', zip: '38725', isBirthingFriendly: true, qualityRating: 4.2, tmahIntegrated: true, distance: '8.4 mi' },
];

const BirthingFriendlyView: React.FC = () => {
  const palette = dashboardTheme;
  const [hospitals, setHospitals] = useState<Hospital[]>(MOCK_HOSPITALS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFriendly, setFilterFriendly] = useState(false);
  const [aiSummary, setAiSummary] = useState('Enter a location, zip code, or facility name to get AI-ranked recommendations.');
  const [rankedIds, setRankedIds] = useState<string[]>(MOCK_HOSPITALS.map((h) => h.id));
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(24);

  useEffect(() => {
    let isCancelled = false;
    const loadFacilities = async () => {
      try {
        const response = await fetch('/api/facilities');
        if (!response.ok) throw new Error(`Facility API failed: ${response.status}`);
        const data = await response.json();
        const csvFacilities = Array.isArray(data?.facilities) ? data.facilities : [];
        if (!isCancelled && csvFacilities.length) {
          setHospitals(csvFacilities);
          setRankedIds(csvFacilities.map((h: Hospital) => h.id));
        }
      } catch (error) {
        console.error('Unable to load facilities CSV data, using fallback mock dataset.', error);
      }
    };

    loadFacilities();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const runSearch = async () => {
      if (!searchQuery.trim()) {
        setAiSummary('Enter a location, zip code, or facility name to get AI-ranked recommendations.');
        setRankedIds(hospitals.map((h) => h.id));
        setIsAiSearching(false);
        return;
      }

      setIsAiSearching(true);
      const result = await searchBirthingFriendlySites(searchQuery, hospitals);
      if (!isCancelled) {
        setAiSummary(result.summary);
        setRankedIds(result.recommendedIds);
        setIsAiSearching(false);
      }
    };

    const timer = window.setTimeout(runSearch, 350);
    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, hospitals]);

  // Reset pagination whenever filter changes
  useEffect(() => {
    setDisplayLimit(24);
  }, [searchQuery, filterFriendly]);

  const filteredHospitals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rankedMap = new Map(rankedIds.map((id, idx) => [id, idx]));
    const directMatches = hospitals.filter(h => {
      const searchable = `${h.name} ${h.address} ${h.city} ${h.state} ${h.zip}`.toLowerCase();
      const matchesSearch = !q || searchable.includes(q);
      const matchesFriendly = filterFriendly ? h.isBirthingFriendly : true;
      return matchesSearch && matchesFriendly;
    });

    // If user typed a location and direct string matching finds nothing,
    // show AI-ranked candidates instead of an empty result grid.
    const fallbackIds = new Set(rankedIds);
    const fallbackMatches = q
      ? hospitals.filter((h) => {
          const matchesFriendly = filterFriendly ? h.isBirthingFriendly : true;
          return matchesFriendly && fallbackIds.has(h.id);
        })
      : [];

    const results = directMatches.length > 0 ? directMatches : fallbackMatches;

    return results.sort((a, b) => {
      const rankA = rankedMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rankedMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });
  }, [searchQuery, filterFriendly, rankedIds, hospitals]);

  return (
    <div
      className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar"
      style={{ background: `linear-gradient(170deg, ${palette.surface} 0%, #f2ece1 52%, #edf3ef 100%)` }}
    >
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-teal-600 uppercase tracking-[0.2em]">
            <Building2 className="w-3.5 h-3.5" />
            CMS Provider Data Integration
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Birthing-Friendly Facility Search
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold border border-teal-200">State Certified</span>
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            Locate hospitals and health systems with the CMS <span className="text-slate-900 font-bold">"Birthing-Friendly"</span> designation—recognizing high-quality maternity care and safety protocol implementation.
          </p>
        </div>
        <div className="flex gap-2">
           <a 
            href="https://data.cms.gov/provider-data/birthing-friendly-hospitals-and-health-systems" 
            target="_blank" 
            rel="noopener noreferrer"
             className="border px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 transition-all"
             style={{ backgroundColor: palette.card, borderColor: palette.border }}
           >
             <ExternalLink className="w-4 h-4 text-slate-400" />
             Source: CMS.gov
           </a>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="p-6 rounded-3xl border shadow-sm space-y-4" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
         <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
               <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
               <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Hospital Name, City, or Zip Code..."
                  className="w-full pl-10 pr-4 py-3 border rounded-2xl text-sm focus:ring-2 transition-all outline-none"
                  style={{ backgroundColor: palette.surface, borderColor: palette.border, ['--tw-ring-color' as any]: palette.teal }}
               />
            </div>
            <button 
              onClick={() => setFilterFriendly(!filterFriendly)}
              className={`px-6 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all
                ${filterFriendly ? 'text-white shadow-lg' : 'text-slate-600'}`}
              style={filterFriendly ? { backgroundColor: palette.teal, borderColor: palette.teal } : { backgroundColor: palette.card, borderColor: palette.border }}
            >
              <CheckCircle2 className={`w-4 h-4 ${filterFriendly ? 'text-white' : 'text-slate-400'}`} />
              Birthing-Friendly Only
            </button>
            <button className="px-6 py-3 border text-slate-600 rounded-2xl text-xs font-bold flex items-center gap-2" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
               <Filter className="w-4 h-4 text-slate-400" />
               Advanced Filters
            </button>
         </div>
        <div className="text-xs rounded-xl border px-3 py-2" style={{ backgroundColor: '#f3f8f5', borderColor: '#d6e7de', color: '#3f675a' }}>
          {isAiSearching ? 'Analyzing facilities with Gemini AI...' : aiSummary}
        </div>
      </div>

      {/* TOP INSIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InsightCard 
           icon={<ShieldCheck className="w-5 h-5 text-teal-500" />}
           label="System Readiness"
           value="72%"
           desc="MCO population mapped to Birthing-Friendly facilities."
        />
        <InsightCard 
           icon={<Zap className="w-5 h-5 text-amber-500" />}
           label="TMaH Integration"
           value="12"
           desc="Facilities with direct TMaH protocol synchronization."
        />
        <InsightCard 
           icon={<Activity className="w-5 h-5 text-teal-500" />}
           label="Quality Gap"
           value="-14%"
           desc="Reduction in readmissions at 'Friendly' designated sites."
        />
      </div>

      {/* RESULTS COUNT */}
      {filteredHospitals.length > 0 && (
        <div className="text-xs text-slate-500 font-semibold -mb-4">
          Showing {Math.min(displayLimit, filteredHospitals.length)} of {filteredHospitals.length} facilities
        </div>
      )}

      {/* RESULTS GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-4">
         {filteredHospitals.slice(0, displayLimit).map(hospital => (
           <HospitalCard key={hospital.id} hospital={hospital} />
         ))}
         {filteredHospitals.length === 0 && (
           <div className="col-span-full py-20 rounded-3xl border border-dashed flex flex-col items-center justify-center text-slate-400" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
              <Building2 className="w-12 h-12 mb-4 opacity-10" />
              <p className="font-bold">No facilities found matching your criteria.</p>
           </div>
         )}
      </div>

      {/* LOAD MORE */}
      {filteredHospitals.length > displayLimit && (
        <div className="flex justify-center pb-20">
          <button
            onClick={() => setDisplayLimit(prev => prev + 24)}
            className="px-8 py-3 rounded-2xl text-sm font-bold border shadow-sm transition-all hover:shadow-md"
            style={{ backgroundColor: palette.card, borderColor: palette.border, color: palette.teal }}
          >
            Load More ({filteredHospitals.length - displayLimit} remaining)
          </button>
        </div>
      )}
      {filteredHospitals.length <= displayLimit && filteredHospitals.length > 0 && <div className="pb-20" />}

    </div>
  );
};

// Fixed type error in InsightCard by providing explicit props interface
const InsightCard: React.FC<{ icon: React.ReactNode; label: string; value: string; desc: string }> = ({ icon, label, value, desc }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl group-hover:bg-white transition-colors">{icon}</div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    </div>
    <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
    <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">{desc}</p>
  </div>
);

// Fixed type error in HospitalCard by using React.FC to correctly handle standard React props like key
const HospitalCard: React.FC<{ hospital: Hospital }> = ({ hospital }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row group hover:border-teal-300 hover:shadow-xl transition-all duration-300">
       <div className="w-full md:w-48 bg-slate-100 flex items-center justify-center relative overflow-hidden shrink-0">
          <Building2 className="w-12 h-12 text-slate-300 group-hover:scale-110 transition-transform duration-500" />
          {hospital.isBirthingFriendly && (
             <div className="absolute top-3 left-3 bg-teal-500 text-white text-[9px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-tighter">
               <Star className="w-2.5 h-2.5 fill-white" />
               Birthing-Friendly
             </div>
          )}
          <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-black text-slate-700 border border-slate-200">
             {hospital.distance}
          </div>
       </div>

       <div className="flex-1 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-1">
             <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-teal-600 transition-colors">{hospital.name}</h3>
             <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-black border ${hospital.qualityRating > 0 ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
               <Star className={`w-3 h-3 ${hospital.qualityRating > 0 ? 'fill-teal-600' : 'fill-slate-300'}`} />
               {hospital.qualityRating > 0 ? `${hospital.qualityRating}/5` : 'N/A'}
             </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-4">
             <MapPin className="w-3.5 h-3.5 text-slate-400" />
             {hospital.address}, {hospital.city}, {hospital.state} {hospital.zip}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-slate-50">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">TMaH Status</span>
                <span className={`text-[11px] font-bold ${hospital.tmahIntegrated ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hospital.tmahIntegrated ? 'Full Integration' : 'Standard Connection'}
                </span>
             </div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Designation</span>
                <span className="text-[11px] font-bold text-slate-700">Birthing Hospital</span>
             </div>
          </div>

          <div className="mt-6 flex gap-2">
             <button className="flex-1 py-2.5 bg-teal-600 text-white text-[10px] font-black rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2">
                <Navigation className="w-3.5 h-3.5" />
                Dispatch Transport
             </button>
             <button className="px-4 py-2.5 bg-white border border-slate-200 text-[10px] font-black text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center">
                View Full Metrics
             </button>
          </div>
       </div>
    </div>
  );
};

export default BirthingFriendlyView;