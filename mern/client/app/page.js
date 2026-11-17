import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Bell, CalendarDays, EyeOff, HandHelping, MapPin, Megaphone, PackageSearch,
  ShieldCheck, Siren, Store, Tag, UserCheck, Wrench,
} from 'lucide-react';
import Logo from '@/components/Logo';
import HeroMap from '@/components/landing/HeroMap';
import RadiusDemo from '@/components/landing/RadiusDemo';
import LandingNav from '@/components/landing/LandingNav';

const FEATURES = [
  { icon: Megaphone, tone: 'green', title: 'Local news & notices', body: 'Power cuts, road works, mosque and school announcements, straight from the people nearby.', eg: '“Gas line repair on Road 7 tomorrow, 9–12”' },
  { icon: HandHelping, tone: 'brick', title: 'Ask for help', body: 'Borrow a ladder, find a blood donor, get a hand moving a sofa. Neighbours answer in minutes.', eg: '“Need O+ blood at Square Hospital tonight”' },
  { icon: Tag, tone: 'plum', title: 'Buy, sell & give away', body: 'Trade with people you can walk to. No courier, no strangers from across the city.', eg: '“Study table, barely used · ৳2,000”' },
  { icon: Wrench, tone: 'sky', title: 'Trusted local services', body: 'Electricians, tutors and cooks with reviews written only by verified neighbours.', eg: '“Rafiq Plumbing · 4.8 ★ from 52 neighbours”' },
  { icon: PackageSearch, tone: 'sun', title: 'Lost & found', body: 'A photo, a pin, an area: the people who walk past it every day will see it first.', eg: '“Found: school bag near the park gate”' },
  { icon: CalendarDays, tone: 'green', title: 'Events nearby', body: 'Cleanup drives, iftar gatherings, cricket on Friday. Know what’s on before it’s over.', eg: '“Block C cleanup · Sat 8 am · 23 going”' },
];

const FAQ = [
  ['Can other people see where I live?', 'No. Your exact pin never leaves our server. Other residents only ever see an approximate area, snapped to a ~500 m grid, so nobody can work out your door from what you post.'],
  ['Who can join?', 'Anyone with a working email address. You confirm your email before you can sign in, and people who break the rules can be suspended by moderators.'],
  ['How is this different from a Facebook or WhatsApp group?', 'Groups are organised by who you happen to know. Neighborly is organised by distance: you see everything within the radius you choose, sorted and searchable, with one place for alerts.'],
  ['I run a small business. Can I list my services?', 'Yes. Choose “Service provider” at sign-up and add your trade. Neighbours nearby can find you and leave reviews after a job.'],
  ['What does it cost?', 'Nothing. Neighborly is free for residents and service providers.'],
  ['How do emergency alerts work?', 'Verified moderators can send an alert to everyone within range. It arrives instantly in the app and as a push notification on devices where you’ve allowed it.'],
];

export default function Landing() {
  return (
    <>
      <LandingNav />
      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><MapPin size={15} /> Built for neighbourhoods in Bangladesh</span>
              <h1 className="hero-title">Know what’s happening <em>on your street.</em></h1>
              <p className="hero-lede">
                Notices, requests for help, things for sale, trusted local services and urgent alerts in one feed,
                limited to the 1–10 km around your home and shared only with verified neighbours.
              </p>
              <div className="hero-cta">
                <Link href="/register" className="btn btn-primary btn-lg">Join your neighbourhood <ArrowRight size={18} /></Link>
                <Link href="/login" className="btn btn-lg">I have an account</Link>
              </div>
              <ul className="hero-proof">
                <li><BadgeCheck size={17} /> Verified accounts</li>
                <li><EyeOff size={17} /> Your address stays private</li>
                <li><ShieldCheck size={17} /> Free, no ads</li>
              </ul>
            </div>
            <HeroMap />
          </div>
        </section>

        {/* ---------- Problem ---------- */}
        <section className="problem">
          <div className="wrap problem-grid">
            <div>
              <span className="eyebrow">Sound familiar?</span>
              <h2 className="section-title">Your neighbourhood is spread across a dozen group chats.</h2>
            </div>
            <div className="problem-list">
              <p><span className="pill-src">WhatsApp group</span> The water-cut notice, buried under 300 good-morning messages.</p>
              <p><span className="pill-src">Facebook group</span> The lost cat, posted to 40,000 people across the city.</p>
              <p><span className="pill-src">Someone’s Messenger</span> The only good electrician’s number, if you know who to ask.</p>
              <p className="problem-answer"><MapPin size={18} /> Neighborly puts it in one place, filtered by how far it is from your door.</p>
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section className="section" id="features">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Everything local, one feed</span>
              <h2 className="section-title">Six things neighbours actually need from each other.</h2>
            </div>
            <div className="feature-grid">
              {FEATURES.map(({ icon: Icon, tone, title, body, eg }) => (
                <article key={title} className={`feature tone-${tone}`}>
                  <span className="feature-ico"><Icon size={22} /></span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <p className="feature-eg">{eg}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="section section-alt" id="how">
          <div className="wrap how-grid">
            <div>
              <span className="eyebrow">How it works</span>
              <h2 className="section-title">Three minutes from sign-up to your street.</h2>
              <ol className="steps">
                <li><span className="step-n">1</span><div><h3>Create your account</h3><p>Sign up as a resident or a service provider, then confirm your email.</p></div></li>
                <li><span className="step-n">2</span><div><h3>Drop a pin at home</h3><p>Search your address or use your location. Only you ever see the exact pin.</p></div></li>
                <li><span className="step-n">3</span><div><h3>Choose how far you care</h3><p>1 km for your block, 10 km for your side of town. Change it any time.</p></div></li>
              </ol>
            </div>
            <RadiusDemo />
          </div>
        </section>

        {/* ---------- Privacy ---------- */}
        <section className="section" id="safety">
          <div className="wrap privacy-grid">
            <div className="privacy-visual" aria-hidden="true">
              <div className="pv-panel">
                <span className="pv-tag">What you see</span>
                <div className="pv-map"><span className="pv-exact" /></div>
                <p>Your exact home</p>
              </div>
              <ArrowRight className="pv-arrow" size={22} />
              <div className="pv-panel">
                <span className="pv-tag pv-tag-alt">What neighbours see</span>
                <div className="pv-map pv-map-grid"><span className="pv-cell" /></div>
                <p>A ~500 m area</p>
              </div>
            </div>
            <div>
              <span className="eyebrow">Safety & privacy</span>
              <h2 className="section-title">Trust is the product. We built it in from day one.</h2>
              <ul className="trust-list">
                <li><UserCheck size={20} /><div><strong>Real people.</strong> Every account confirms an email before it can sign in. Moderators can suspend people who abuse the community.</div></li>
                <li><EyeOff size={20} /><div><strong>Approximate location only.</strong> Your pin is snapped to a ~500 m grid before anyone else sees it.</div></li>
                <li><ShieldCheck size={20} /><div><strong>Locked-down accounts.</strong> Hashed passwords, automatic lockout after repeated failed sign-ins, and a list of signed-in devices you can revoke.</div></li>
                <li><BadgeCheck size={20} /><div><strong>Roles are earned.</strong> Nobody can make themselves a moderator or admin. Those roles are assigned.</div></li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Emergency band ---------- */}
        <section className="emergency">
          <div className="wrap emergency-grid">
            <div className="emergency-ico"><Siren size={30} /></div>
            <div>
              <h2>When it’s urgent, everyone nearby knows in seconds.</h2>
              <p>Fire, flooding, a missing child: verified moderators can alert everyone in range at once, in the app and by push notification.</p>
            </div>
            <div className="emergency-demo" aria-hidden="true">
              <Bell size={16} />
              <div><strong>Emergency · 0.6 km</strong><span>Fire reported at Road 4 market. Avoid the area.</span></div>
            </div>
          </div>
        </section>

        {/* ---------- Who it's for ---------- */}
        <section className="section" id="roles">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Who it’s for</span>
              <h2 className="section-title">One neighbourhood, a few different hats.</h2>
            </div>
            <div className="role-grid">
              <article className="role card">
                <span className="role-ico tone-green"><MapPin size={22} /></span>
                <h3>Residents</h3>
                <p>Follow what’s happening, ask for help, trade, and find people you can trust to fix things.</p>
                <Link href="/register?role=resident" className="link">Join as a resident</Link>
              </article>
              <article className="role card">
                <span className="role-ico tone-sky"><Store size={22} /></span>
                <h3>Service providers</h3>
                <p>Get found by customers who live minutes away, and build a reputation from neighbour reviews.</p>
                <Link href="/register?role=provider" className="link">Join as a provider</Link>
              </article>
              <article className="role card role-muted">
                <span className="role-ico tone-sun"><ShieldCheck size={22} /></span>
                <h3>Moderators</h3>
                <p>Trusted locals who keep things kind and handle reports within a day. By invitation only.</p>
                <span className="badge">Assigned, not chosen</span>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="section section-alt" id="faq">
          <div className="wrap faq-grid">
            <div>
              <span className="eyebrow">Questions</span>
              <h2 className="section-title">Things people ask before joining.</h2>
            </div>
            <div className="faq">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="final-cta">
          <div className="wrap final-cta-inner">
            <h2>Your neighbours are already talking.<br />Come say hello.</h2>
            <Link href="/register" className="btn btn-accent btn-lg">Create a free account <ArrowRight size={18} /></Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <Logo />
            <p className="muted small" style={{ marginTop: 10, maxWidth: 320 }}>One trusted place for your neighbourhood. A student capstone project.</p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <a href="#features">Features</a>
            <a href="#safety">Safety</a>
            <a href="#faq">FAQ</a>
            <Link href="/login">Sign in</Link>
            <Link href="/register">Create account</Link>
          </nav>
        </div>
        <div className="wrap footer-base tiny muted">© {new Date().getFullYear()} Neighborly · Map data © OpenStreetMap contributors</div>
      </footer>
    </>
  );
}
