'use client';
import { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { FEATURES } from '@/lib/features';

export default function ComingSoon({ params }) {
  const { feature } = use(params);
  const f = FEATURES[feature];
  if (!f) notFound();
  const Icon = f.icon;
  return (
    <div className="soon card">
      <span className="soon-ico"><Icon size={30} /></span>
      <span className="badge badge-sun">Coming {f.phase === 2 ? 'next' : 'soon'}</span>
      <h1>{f.label}</h1>
      <p className="muted">{f.blurb}</p>
      <ul className="soon-ready small">
        <li><Check size={16} /> Your account is verified</li>
        <li><Check size={16} /> Your home area and radius are set</li>
        <li><Check size={16} /> You’ll see this here as soon as it launches</li>
      </ul>
      <Link href="/home" className="btn"><ArrowLeft size={16} /> Back to home</Link>
    </div>
  );
}
