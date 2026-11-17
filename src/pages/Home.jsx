import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'
import { getAlerts, getHelpRequests, getListings, getLostFound, getNeighborhoods } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatPrice, labelize, timeAgo } from '../lib/format'
import { t } from '../lib/i18n'
import { ComposerBox } from '../components/Composer'
import FeedList from '../components/FeedList'
import RightRail from '../components/RightRail'
import { ContactLinks } from '../components/FormBits'
import { Avatar, Empty, Spinner } from '../components/ui'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'lost_found', label: 'Lost & Found' },
  { id: 'buy_sell', label: 'Buy & Sell' },
  { id: 'help', label: 'Help Requests' },
  { id: 'alerts', label: 'Emergency Alerts' },
]

export default function Home() {
  const [params, setParams] = useSearchParams()
  const cat = CATEGORIES.some((c) => c.id === params.get('cat')) ? params.get('cat') : 'all'
  const q = params.get('q') || ''
  const { profile } = useAuth()
  const [search, setSearch] = useState(q)
  const [neighborhoods, setNeighborhoods] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => { getNeighborhoods().then(setNeighborhoods).catch(() => {}) }, [])
  useEffect(() => { setSearch(q) }, [q])

  const update = (changes) => {
    const next = { cat, q, ...changes }
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'cat' && v === 'all'))))
  }
  // Everything on the home page is limited to the signed-in person's own community.
  const hoodId = profile?.neighborhood_id ? Number(profile.neighborhood_id) : undefined
  const myHood = neighborhoods.find((n) => n.id === hoodId)

  return (
    <>
      <section className="hero">
        <h1>{t('Connect with Your Local Neighborhood')}</h1>
        <p>{t('A trusted digital space where nearby residents communicate, share updates, discover services, and solve local problems together.')}</p>
        <form className="hero-search" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }) }}>
          <input className="input" placeholder={t('Search your community…')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('Search your community…')} />
          <button className="btn btn-primary" aria-label={t('Search')}><Search size={18} /> <span className="hide-sm">{t('Search')}</span></button>
        </form>
        <p className="hero-community">
          <MapPin size={14} /> {hoodId
            ? <>{t('Showing posts from your community:')} <b>{myHood ? `${myHood.name}${myHood.city ? `, ${myHood.city}` : ''}` : '…'}</b></>
            : <>{t('Choose your community to see only your neighbors’ posts.')} <Link to={`/profile/${profile?.username}`}>{t('Set my community')}</Link></>}
        </p>
      </section>

      <div className="home-grid">
        <aside className="left">
          <div className="side-card">
            <h3>{t('Categories')}</h3>
            <div className="cats">
              {CATEGORIES.map((c) => (
                <button key={c.id} className={`cat-item ${cat === c.id ? 'active' : ''}`} onClick={() => update({ cat: c.id })}>{t(c.label)}</button>
              ))}
            </div>
          </div>
        </aside>

        <main className="home-feed">
          {(cat === 'all' || cat === 'announcements') ? (
            <>
              {!q && <ComposerBox onPosted={() => setReloadKey((k) => k + 1)} />}
              <FeedList reloadKey={reloadKey}
                filters={{ search: q || undefined, neighborhoodId: hoodId, postType: cat === 'announcements' ? 'announcement' : undefined }}
                emptyText={q ? t('Nothing matches your search.') : undefined} />
            </>
          ) : (
            <KindFeed kind={cat} search={q} hoodId={hoodId} />
          )}
        </main>

        <RightRail />
      </div>
    </>
  )
}

// Lost & found, buy & sell, help requests and alerts shown as feed cards
const KINDS = {
  lost_found: {
    load: (search) => getLostFound({ search: search || undefined }), page: '/lost-found', pill: 'Lost & Found',
    map: (r) => ({ title: `${t(r.report_type === 'lost' ? 'Lost' : 'Found')}: ${r.item_name}`, body: r.description, place: r.location, link: `/lost-found?item=${r.id}` }),
  },
  buy_sell: {
    load: (search) => getListings({ search: search || undefined }), page: '/marketplace', pill: 'Buy & Sell',
    map: (r) => ({ title: r.title, body: `${r.description}\n${t('Price')}: ${formatPrice(r.price, r.listing_type)}`, place: r.location_name, link: `/marketplace?item=${r.id}`, image: r.image_url }),
  },
  help: {
    load: () => getHelpRequests({ status: 'active' }), page: '/services?tab=help', pill: 'Help Requests',
    map: (r) => ({ title: r.title, body: r.details, place: labelize(r.help_type), link: `/services?tab=help&item=${r.id}` }),
  },
  alerts: {
    load: () => getAlerts({ status: 'active' }), page: '/alerts', pill: 'Emergency Alerts',
    map: (r) => ({ title: r.title, body: r.message, place: r.location_name, link: '/alerts' }),
  },
}

function KindFeed({ kind, search, hoodId }) {
  const cfg = KINDS[kind]
  const [rows, setRows] = useState(null)
  useEffect(() => { setRows(null); cfg.load(search).then(setRows).catch(() => setRows([])) }, [kind, search]) // eslint-disable-line react-hooks/exhaustive-deps

  if (rows === null) return <Spinner />
  const needle = search.toLowerCase()
  const shown = rows.filter((r) => (!hoodId || r.neighborhood_id === hoodId)
    && (!needle || JSON.stringify([r.title, r.item_name, r.description, r.details, r.message]).toLowerCase().includes(needle)))

  return (
    <>
      <div className="flex between items-center wrap gap-8">
        <span className="muted small">{t('{n} results', { n: shown.length })}</span>
        <Link to={cfg.page} className="btn btn-primary btn-sm">{t('Open {name}', { name: t(cfg.pill) })}</Link>
      </div>
      {shown.length === 0 ? <div className="card"><Empty title={t('Nothing here yet')} text={t('Be the first to post something for your neighbors.')} /></div> : shown.map((r) => {
        const v = cfg.map(r)
        return (
          <article key={r.id} className="card feed-item">
            <div className="flex gap-12 items-center">
              <Avatar src={r.author?.avatar_url} name={r.author?.full_name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/profile/${r.author?.username}`} className="post-author">{r.author?.full_name}</Link>
                <div className="post-meta">{timeAgo(r.created_at)}{v.place && <> • <MapPin size={12} color="var(--red)" /> {v.place}</>}</div>
              </div>
              <span className="cat-pill">{t(cfg.pill)}</span>
            </div>
            <h3>{v.title}</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }} className="clamp-3">{v.body}</p>
            {v.image && <img src={v.image} alt="" loading="lazy" style={{ marginTop: 12, borderRadius: 8, maxHeight: 320, width: '100%', objectFit: 'cover' }} />}
            <div className="foot">
              <ContactLinks phone={r.contact_phone} email={r.contact_email} />
              <Link to={v.link} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>{t('View details')}</Link>
            </div>
          </article>
        )
      })}
    </>
  )
}
