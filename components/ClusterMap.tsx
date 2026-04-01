import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { AlertCircle, Users, Zap, ShoppingBasket, Bus, Stethoscope } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Set as default for all markers
L.Icon.Default.prototype.options = DefaultIcon.options;

interface ClusterData {
  id: number;
  zip: string;
  risk: 'Critical' | 'High' | 'Moderate';
  stressors: string[];
  members: number;
  top: string;
  left: string;
  type: 'clinical' | 'environmental' | 'resource';
  clinicalData?: any;
  environmentalData?: any;
  resourceData?: any;
}

interface ClusterMapProps {
  clusters: ClusterData[];
  overlay?: 'clinical' | 'environmental' | 'resource' | null;
}

// Mock ZIP code to coordinate mapping (representing different areas)
const zipCodeCoordinates: { [key: string]: LatLngExpression } = {
  'Unknown': [40.7128, -74.0060], // New York City (default)
  '10001': [40.7480, -73.9967],
  '10002': [40.7155, -73.9896],
  '10003': [40.7307, -73.9896],
  '10004': [40.7034, -74.0170],
  '10005': [40.7074, -74.0113],
  '10006': [40.7085, -74.0079],
  '10007': [40.7122, -74.0055],
  '10008': [40.7037, -74.0162],
  '10009': [40.7260, -73.9897],
  '10010': [40.7352, -73.9823],
};

// Convert percentage positioning to geographic coordinates based on cluster location
const getCoordinatesFromCluster = (cluster: ClusterData): LatLngExpression => {
  // If we have a ZIP code coordinate, use it
  if (zipCodeCoordinates[cluster.zip]) {
    return zipCodeCoordinates[cluster.zip];
  }

  // Default coordinates (NYC area center)
  const baseCoords: [number, number] = [40.7580, -73.9855];
  
  // Convert percentage to offset
  const topPercent = parseFloat(cluster.top) / 100;
  const leftPercent = parseFloat(cluster.left) / 100;

  // Create variation in coordinates based on percentage
  const latVariation = (topPercent - 0.5) * 0.1;
  const lngVariation = (leftPercent - 0.5) * 0.15;

  return [
    baseCoords[0] + latVariation,
    baseCoords[1] + lngVariation
  ];
};

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'Critical':
      return '#ef4444'; // red-500
    case 'High':
      return '#f97316'; // orange-500
    case 'Moderate':
      return '#eab308'; // yellow-500
    default:
      return '#6b7280'; // gray-500
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'clinical':
      return <Stethoscope className="w-3 h-3" />;
    case 'environmental':
      return <Zap className="w-3 h-3" />;
    case 'resource':
      return <ShoppingBasket className="w-3 h-3" />;
    default:
      return <AlertCircle className="w-3 h-3" />;
  }
};

const ClusterMap: React.FC<ClusterMapProps> = ({ clusters, overlay }) => {
  const [mapKey, setMapKey] = useState(0);

  // Filter clusters based on overlay
  const filteredClusters = overlay
    ? clusters.filter(c => c.type === overlay)
    : clusters;

  // Calculate map center
  const mapCenter: LatLngExpression = filteredClusters.length > 0
    ? getCoordinatesFromCluster(filteredClusters[0])
    : [40.7128, -74.0060];

  useEffect(() => {
    // Force re-render of map when overlay changes
    setMapKey(prev => prev + 1);
  }, [overlay]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-lg border border-gray-200">
      <MapContainer
        key={mapKey}
        center={mapCenter}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {filteredClusters.map((cluster) => {
          const coords = getCoordinatesFromCluster(cluster);
          const riskColor = getRiskColor(cluster.risk);

          return (
            <React.Fragment key={cluster.id}>
              {/* Risk radius circle */}
              <Circle
                center={coords}
                radius={cluster.members * 50}
                pathOptions={{
                  fillColor: riskColor,
                  color: riskColor,
                  opacity: 0.3,
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              />

              {/* Cluster marker */}
              <Marker position={coords} icon={DefaultIcon}>
                <Popup maxWidth={300}>
                  <div className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">{cluster.zip}</h3>
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: riskColor }}
                      >
                        {cluster.risk}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{cluster.members} members</span>
                    </div>

                    <div className="text-sm">
                      <div className="font-semibold mb-1">Stressors:</div>
                      <div className="flex flex-wrap gap-1">
                        {cluster.stressors.map((stressor, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 rounded text-xs"
                          >
                            {stressor}
                          </span>
                        ))}
                      </div>
                    </div>

                    {cluster.type === 'clinical' && cluster.clinicalData && (
                      <div className="text-sm border-t pt-2">
                        <div className="font-semibold mb-1">Clinical Data:</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Hypertension: <strong>{cluster.clinicalData.hypertension}</strong></div>
                          <div>Diabetes: <strong>{cluster.clinicalData.diabetes}</strong></div>
                          <div>Risk Score: <strong>{cluster.clinicalData.avgRiskScore}%</strong></div>
                          <div>Success Rate: <strong>{cluster.clinicalData.interventionSuccess}%</strong></div>
                        </div>
                      </div>
                    )}

                    {cluster.type === 'environmental' && cluster.environmentalData && (
                      <div className="text-sm border-t pt-2">
                        <div className="font-semibold mb-1">Environmental Data:</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>AQI: <strong>{cluster.environmentalData.aqi}</strong></div>
                          <div>Heat Index: <strong>{cluster.environmentalData.heatIndex}°F</strong></div>
                          <div>Humidity: <strong>{cluster.environmentalData.humidity}%</strong></div>
                          <div>Pollution: <strong>{cluster.environmentalData.pollutionLevel}</strong></div>
                        </div>
                      </div>
                    )}

                    {cluster.type === 'resource' && cluster.resourceData && (
                      <div className="text-sm border-t pt-2">
                        <div className="font-semibold mb-1">Resource Data:</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Food Access: <strong>{cluster.resourceData.foodAccess}</strong></div>
                          <div>Transport: <strong>{cluster.resourceData.transportAccess}</strong></div>
                          <div>Healthcare: <strong>{cluster.resourceData.healthcareFacilities}</strong></div>
                          <div>Pharmacy: <strong>{cluster.resourceData.pharmacyAccess} mi</strong></div>
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default ClusterMap;
