'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const pinIcon = L.divIcon({
  className: 'nb-pin',
  html: '<span class="nb-pin-dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function FitRadius({ center, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(center).toBounds(radiusKm * 2000 * 1.15);
    map.flyToBounds(bounds, { duration: 0.6, padding: [12, 12] });
  }, [map, center, radiusKm]);
  return null;
}

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/**
 * Leaflet + OpenStreetMap tiles (no API key). Shows a home pin and the radius circle.
 * `editable` lets the user click or drag to move the pin.
 */
/** pin: 'exact' (owner's own draggable pin), 'approx' (privacy area), or 'none'. */
export default function AreaMap({ center, radiusKm, editable = false, onPick, pin = 'exact', height = 320 }) {
  const pos = useMemo(() => [center.lat, center.lng], [center.lat, center.lng]);
  const handlers = useMemo(() => ({
    dragend: (e) => { const { lat, lng } = e.target.getLatLng(); onPick?.({ lat, lng }); },
  }), [onPick]);

  return (
    <div className="area-map" style={{ height }}>
      <MapContainer center={pos} zoom={14} scrollWheelZoom={editable} style={{ height: '100%', width: '100%' }} attributionControl>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <Circle center={pos} radius={radiusKm * 1000} pathOptions={{ color: '#1f4d3a', weight: 2, fillColor: '#1f4d3a', fillOpacity: 0.08, dashArray: '6 6' }} />
        {pin === 'exact' && <Marker position={pos} icon={pinIcon} draggable={editable} eventHandlers={handlers} keyboard={false} />}
        {pin === 'approx' && <Circle center={pos} radius={250} pathOptions={{ color: '#c8553a', weight: 1.5, fillColor: '#c8553a', fillOpacity: 0.25 }} />}
        {editable && <ClickToPick onPick={onPick} />}
        <FitRadius center={pos} radiusKm={radiusKm} />
      </MapContainer>
    </div>
  );
}
