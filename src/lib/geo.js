import { t } from './i18n'
// Default map centre: Daffodil Smart City / Ashulia, Dhaka
export const DEFAULT_CENTER = [23.8768, 90.3209]

export function distanceKm(a, b) {
  if (!a || !b || a[0] == null || b[0] == null) return null
  const R = 6371
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(km) {
  if (km == null) return ''
  if (km < 1) return t('{n} m away', { n: Math.round(km * 1000) })
  return t('{n} km away', { n: km.toFixed(km < 10 ? 1 : 0) })
}

// Bounding box for a radius search, used with .gte/.lte filters
export function boundingBox([lat, lng], km) {
  const dLat = km / 111
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180))
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng }
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(t('Location is not supported in this browser')))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => reject(new Error(t('Could not get your location. Please allow location access.'))),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
