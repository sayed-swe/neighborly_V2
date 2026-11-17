// Right column of the home feed: emergency alerts, local services, neighbors, events
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAlerts, getEvents } from '../lib/api'
import { formatDateTime, timeAgo } from '../lib/format'
import { t } from '../lib/i18n'

export default function RightRail() {
  const [alerts, setAlerts] = useState(null)
  const [events, setEvents] = useState([])
  useEffect(() => {
    getAlerts({ status: 'active' }).then((a) => setAlerts(a.slice(0, 3))).catch(() => setAlerts([]))
    getEvents({ when: 'upcoming' }).then((e) => setEvents(e.slice(0, 2))).catch(() => {})
  }, [])

  return (
    <aside className="right">
      <div className="side-card">
        <h3>{t('🚨 Emergency Alerts')}</h3>
        {alerts === null ? null : alerts.length === 0 ? <p>{t('No active alerts in your area.')}</p> : alerts.map((a) => (
          <p key={a.id} style={{ marginBottom: 10 }}><b>{a.title}:</b> {a.message} <span className="small">· {timeAgo(a.created_at)}</span></p>
        ))}
        <Link to="/alerts" className="link small">{t('See all alerts')}</Link>

        <h3 style={{ marginTop: 22 }}>{t('🛠️ Trusted Local Services')}</h3>
        <p>{t('Find verified electricians, plumbers, mechanics, and tutors right in your neighborhood.')}</p>
        <Link to="/services" className="btn btn-primary btn-block mt-12">{t('View Directory')}</Link>
      </div>

      <div className="side-card">
        <h3>{t('📍 Neighbors on the map')}</h3>
        <p>{t('See who lives near you, and what is happening around you.')}</p>
        <Link to="/map" className="btn btn-outline btn-block mt-12">{t('Open map')}</Link>
      </div>

      {events.length > 0 && (
        <div className="side-card">
          <h3>{t('📅 Upcoming events')}</h3>
          {events.map((e) => (
            <p key={e.id} style={{ marginBottom: 8 }}><Link to={`/events?item=${e.id}`}><b>{e.title}</b></Link><br />{formatDateTime(e.starts_at)}</p>
          ))}
          <Link to="/events" className="link small">{t('See all events')}</Link>
        </div>
      )}
    </aside>
  )
}
