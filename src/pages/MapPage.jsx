import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { LocateFixed, MapPin } from 'lucide-react'
import { getMapItems } from '../lib/api'
import { DEFAULT_CENTER, distanceKm, formatDistance, getCurrentPosition } from '../lib/geo'
import { kindLink, MAP_KINDS } from '../lib/constants'
import { timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Empty, Spinner } from '../components/ui'
import { t } from '../lib/i18n'

function FlyTo({ center, zoom }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.8 }) }, [center, zoom, map])
  return null
}

export default function MapPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const focus = params.get('lat') ? [Number(params.get('lat')), Number(params.get('lng'))] : null
  const home = profile.neighborhood?.latitude ? [profile.neighborhood.latitude, profile.neighborhood.longitude] : DEFAULT_CENTER

  const [items, setItems] = useState(null)
  const [kinds, setKinds] = useState(Object.keys(MAP_KINDS))
  const [me, setMe] = useState(null)
  const [radius, setRadius] = useState(2)
  const [center, setCenter] = useState(focus || home)
  const [zoom, setZoom] = useState(focus ? 17 : 15)

  useEffect(() => { getMapItems().then(setItems).catch(() => setItems([])) }, [])

  const locate = async () => {
    try {
      const pos = await getCurrentPosition()
      setMe(pos); setCenter(pos); setZoom(15)
    } catch (e) { toast(e.message, 'error') }
  }

  const origin = me || center
  const visible = useMemo(() => (items || [])
    .filter((i) => kinds.includes(i.kind))
    .map((i) => ({ ...i, km: distanceKm(origin, [i.latitude, i.longitude]) }))
    .filter((i) => !me || i.km <= radius)
    .sort((a, b) => a.km - b.km), [items, kinds, origin, me, radius])

  const toggle = (k) => setKinds((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]))

  return (
    <div className="map-layout">
      <div className="map-box">
        <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: '100%' }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FlyTo center={center} zoom={zoom} />
          {me && (
            <>
              <Circle center={me} radius={radius * 1000} pathOptions={{ color: '#2f5d45', fillColor: '#2f5d45', fillOpacity: 0.06, weight: 1.5 }} />
              <CircleMarker center={me} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2f6db5', fillOpacity: 1 }}>
                <Popup>{t('You are here')}</Popup>
              </CircleMarker>
            </>
          )}
          {visible.map((i) => (
            <CircleMarker key={`${i.kind}-${i.item_id}`} center={[i.latitude, i.longitude]} radius={i.kind === 'alert' ? 11 : 8}
              pathOptions={{ color: '#fff', weight: 2, fillColor: MAP_KINDS[i.kind]?.color, fillOpacity: 0.95 }}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MAP_KINDS[i.kind]?.color, textTransform: 'uppercase' }}>{t(MAP_KINDS[i.kind]?.label)}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, margin: '2px 0' }}>{i.title}</div>
                  {i.subtitle && <div style={{ color: '#6f7570' }}>{i.subtitle}</div>}
                  <Link to={kindLink(i.kind, i.item_id)} style={{ color: '#2f5d45', fontWeight: 700 }}>{t('Open →')}</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="map-filters">
          <div className="chips" style={{ background: 'var(--surface)', padding: 8, borderRadius: 14, boxShadow: 'var(--shadow)', display: 'inline-flex' }}>
            {Object.entries(MAP_KINDS).map(([k, v]) => (
              <button key={k} className={`chip ${kinds.includes(k) ? '' : ''}`} onClick={() => toggle(k)}
                style={{ opacity: kinds.includes(k) ? 1 : 0.45, borderColor: kinds.includes(k) ? v.color : undefined }}>
                <span className="map-legend-dot" style={{ background: v.color }} /> {t(v.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="map-side">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 18 }}>{t('What\'s nearby')}</h3>
          <p className="small muted mt-8">{t('Everything neighbors pinned on the map — problems, help requests, items and events.')}</p>
          <div className="flex gap-8 mt-12 wrap">
            <button className="btn btn-primary btn-sm" onClick={locate}><LocateFixed size={15} /> {me ? t('Update my location') : t('Near me')}</button>
            {me && (
              <select className="select" style={{ width: 'auto', padding: '4px 8px' }} value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                {[0.5, 1, 2, 5, 10].map((r) => <option key={r} value={r}>{t('Within')} {r} {t('km')}</option>)}
              </select>
            )}
            {me && <button className="btn btn-ghost btn-sm" onClick={() => { setMe(null); setCenter(home) }}>{t('Show all')}</button>}
          </div>
        </div>
        {items === null ? <Spinner /> : visible.length === 0 ? (
          <Empty icon={MapPin} title={t('Nothing pinned here')} text={t('Add a location when you post, list an item or raise an alert.')} />
        ) : (
          <div className="mini-list" style={{ padding: 8 }}>
            {visible.slice(0, 100).map((i) => (
              <div key={`${i.kind}-${i.item_id}`} className="mini-item" style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                onClick={() => { setCenter([i.latitude, i.longitude]); setZoom(17) }}>
                <span className="map-legend-dot" style={{ background: MAP_KINDS[i.kind]?.color, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t clamp-2">{i.title}</div>
                  <div className="s">{t(MAP_KINDS[i.kind]?.label)} · {formatDistance(i.km)} · {timeAgo(i.created_at)}</div>
                </div>
                <Link to={kindLink(i.kind, i.item_id)} className="small link" onClick={(e) => e.stopPropagation()}>{t('Open')}</Link>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
