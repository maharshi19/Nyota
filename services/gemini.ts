
import { GoogleGenAI, Type } from "@google/genai";
import { PatientCase, AnalysisResult, Hospital } from "../types";

const parseJSON = (text: string) => {
    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON", e);
        return null;
    }
};

export const analyzeCase = async (patientCase: PatientCase): Promise<AnalysisResult> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Please add your API key to .env.local");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
    You are the "Brain" of the Nyota Visual OS, a proprietary predictive engine for Maternal Health MCOs.
    Your mission is the TMaH (Transforming Maternal Health) model alignment.

    ELIMINATE THE "87% BLIND SPOT" by analyzing:
    1. Clinical Data:
       - Age: ${patientCase.age}, Gestation: ${patientCase.gestation}, Parity: ${patientCase.parity}
       - Vitals: ${patientCase.vitals}, Chief Complaint: ${patientCase.chiefComplaint}
       - Labs: ${patientCase.labs || 'None'}
    2. Environmental & Social Data (Environmental Risk Overlay - Pillar B):
       - SDoH: ${patientCase.socialHistory || 'None'}
       - Environmental Context: Zip Code ${patientCase.environmental?.zipCode}, Air Quality: ${patientCase.environmental?.airQuality}, Heat Index: ${patientCase.environmental?.heatIndex}
    3. Community Care Access (Advocate Workflow Sync - Pillar C):
       - Midwife/Doula/CHW context provided in case data.

    REQUIRED CALCULATIONS:
    - 72-Hour Rising Risk: Predict clinical crisis based on vitals + environmental spikes.
    - C-Section Probability (LRCD-AD/CH): Risk Gauge 0-100% (Pillar A).
    - AI Sentiment/Mood Score: Derived from clinical narrative/social history (Pillar B).
    - Resource Strain Index: 1-10 index for HEDIS PPC compliance (Pillar B).
    - NICU Avoidance: Probablity of NICU stay if intervention is not taken.
    - Admin Burden Saved: Estimated hours saved by unified data exchange for this case.

    Return JSON matching the defined schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safetyChecklist: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  status: { type: Type.STRING },
                  finding: { type: Type.STRING }
                }
              }
            },
            riskScore: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.NUMBER },
                level: { type: Type.STRING },
                window: { type: Type.STRING }
              }
            },
            tmahMetrics: {
              type: Type.OBJECT,
              properties: {
                cSectionProbability: { type: Type.NUMBER },
                sentimentScore: { type: Type.NUMBER },
                resourceStrainIndex: { type: Type.NUMBER },
                nicuProbability: { type: Type.NUMBER },
                adminBurdenSaved: { type: Type.NUMBER }
              }
            },
            differentialDiagnosis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  condition: { type: Type.STRING },
                  likelihood: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
              }
            },
            managementPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  timing: { type: Type.STRING }
                }
              }
            },
            prescriptiveIntelligence: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  interventionType: { type: Type.STRING },
                  cost: { type: Type.NUMBER },
                  potentialSavings: { type: Type.NUMBER },
                  rationale: { type: Type.STRING }
                }
              }
            },
            cognitiveContext: {
              type: Type.OBJECT,
              properties: {
                sdohInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
                communitySupportNote: { type: Type.STRING },
                riskFactors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      factor: { type: Type.STRING },
                      category: { type: Type.STRING },
                      significance: { type: Type.STRING }
                    }
                  }
                }
              }
            },
            biasCorrectionNote: { type: Type.STRING },
            keyLabs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  flag: { type: Type.STRING }
                }
              }
            },
            environmentalHistory: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  airQuality: { type: Type.NUMBER },
                  heatIndex: { type: Type.NUMBER }
                }
              }
            },
            historicalSDoH: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  foodStress: { type: Type.NUMBER },
                  transportStress: { type: Type.NUMBER },
                  housingStress: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const result = parseJSON(response.text);
    return result as AnalysisResult;
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const chatWithAI = async (message: string): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) {
    // Return mock response if API key is not configured
    console.warn("GEMINI_API_KEY is missing - returning mock response");
    return getMockAIResponse(message);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const systemPrompt = `You are a Clinical AI Assistant for Nyota Health - a maternal health decision support system. 
You assist care teams with maternal health questions, clinical case discussions, and evidence-based recommendations.
You are knowledgeable about:
- Maternal health risk assessment
- Clinical decision support
- Social determinants of health (SDoH)
- Environmental health factors affecting pregnancy
- NICU probabilities and preventive interventions
- Equity-centered care approaches

Provide responses that are:
- Evidence-based and clinically accurate
- Compassionate and patient-centered
- Brief and actionable (2-3 sentences typically)
- You can reference specific patients or cases when provided
- Focus on practical care coordination insights

Never provide medical advice without proper clinical context.

User message: ${message}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: systemPrompt
    });

    if (response.candidates && response.candidates.length > 0) {
      const content = response.candidates[0].content;
      if (content.parts && content.parts.length > 0) {
        return content.parts[0].text || "I couldn't generate a response. Please try again.";
      }
    }
    return "I encountered an error processing your request.";
  } catch (error) {
    console.error("Chat Error:", error);
    // Return mock response on error
    return getMockAIResponse(message);
  }
};

export interface FacilitySearchResult {
  summary: string;
  recommendedIds: string[];
}

const fallbackFacilitySearch = (query: string, hospitals: Hospital[]): FacilitySearchResult => {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  const scoreToken = (token: string, h: Hospital): number => {
    const name = h.name.toLowerCase();
    const address = h.address.toLowerCase();
    const city = h.city.toLowerCase();
    const state = h.state.toLowerCase();
    const zip = h.zip.toLowerCase();
    const searchable = `${name} ${address} ${city} ${state} ${zip}`;

    if (zip === token) return 10;
    if (zip.startsWith(token)) return 7;
    if (city.startsWith(token) || state.startsWith(token)) return 6;
    if (name.includes(token)) return 5;
    if (address.includes(token)) return 4;
    if (searchable.includes(token)) return 2;
    return -2;
  };

  const scored = hospitals
    .map((h) => {
      let score = 0;
      for (const token of tokens) {
        score += scoreToken(token, h);
      }
      if (h.isBirthingFriendly) score += 2;
      score += h.qualityRating * 0.2;
      return { id: h.id, score, matched: score > 0 };
    })
    .sort((a, b) => b.score - a.score);

  const matchedOnly = scored.filter((x) => x.matched).slice(0, 6);
  const recommendedIds = (matchedOnly.length ? matchedOnly : scored.slice(0, 3)).map((x) => x.id);
  const summary = matchedOnly.length
    ? `Showing ${matchedOnly.length} best-matching facilities using location and designation signals.`
    : 'No exact local matches found; showing top recommended nearby options.';

  return {
    summary,
    recommendedIds,
  };
};

export const searchBirthingFriendlySites = async (
  query: string,
  hospitals: Hospital[]
): Promise<FacilitySearchResult> => {
  if (!query.trim()) {
    return {
      summary: 'Enter a location, zip code, or facility name to get AI-ranked recommendations.',
      recommendedIds: hospitals.map((h) => h.id),
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return fallbackFacilitySearch(query, hospitals);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const hospitalsForPrompt = hospitals.map((h) => ({
    id: h.id,
    name: h.name,
    city: h.city,
    zip: h.zip,
    birthingFriendly: h.isBirthingFriendly,
    qualityRating: h.qualityRating,
    tmahIntegrated: h.tmahIntegrated,
    distance: h.distance,
  }));

  const prompt = `
You are a maternal-care facility recommendation assistant.
User query: "${query}".

Rank the provided facilities for best maternal-care referral fit.
Prioritize:
1) birthing-friendly designation
2) quality rating
3) likely geographic relevance (city/zip/query)
4) TMaH integration

Return strict JSON with:
- summary: concise 1-2 sentence reasoning
- recommendedIds: ordered facility ids (best first)

Facilities:
${JSON.stringify(hospitalsForPrompt)}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendedIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const parsed = parseJSON(response.text) as FacilitySearchResult | null;
    if (!parsed || !Array.isArray(parsed.recommendedIds)) {
      return fallbackFacilitySearch(query, hospitals);
    }

    return {
      summary: parsed.summary || 'Showing AI-ranked facilities for this query.',
      recommendedIds: parsed.recommendedIds,
    };
  } catch (error) {
    console.error('Facility search AI error:', error);
    return fallbackFacilitySearch(query, hospitals);
  }
};

const getMockAIResponse = (userMessage: string): string => {
  // Provide contextual mock responses for testing without API key
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('risk') || lowerMessage.includes('assess')) {
    return "For maternal health risk assessment, evaluate clinical vitals (BP, HR, temperature), gestational age, medical history, and social determinants of health. The Nyota system integrates these factors to provide a comprehensive risk score with actionable recommendations for your care team.";
  }
  
  if (lowerMessage.includes('nicu') || lowerMessage.includes('prevention')) {
    return "NICU admission probability can be reduced through early intervention, environmental support optimization, and coordinated care. Focus on addressing modifiable risk factors and ensuring consistent prenatal monitoring based on risk tier.";
  }
  
  if (lowerMessage.includes('sdoh') || lowerMessage.includes('social')) {
    return "Social determinants of health significantly impact maternal outcomes. Document housing stability, food security, transportation access, and social support systems. Coordinate with community resources to address barriers and improve care engagement.";
  }
  
  if (lowerMessage.includes('environment') || lowerMessage.includes('air') || lowerMessage.includes('heat')) {
    return "Environmental factors like air quality and heat exposure correlate with adverse pregnancy outcomes. Monitor environmental APIs for your patient's location and provide guidance on reducing exposure, especially for high-risk patients.";
  }
  
  return "I'm the Nyota Clinical AI Assistant. I can help with maternal health risk assessment, clinical decision support, and care coordination insights. Ask me about risk assessment, NICU prevention, social determinants, or environmental health factors.";
};
