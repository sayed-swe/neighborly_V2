'use client';
import { useState } from 'react';
import Modal from '@/components/Modal';

/** 1–4 photos laid out like a social feed; click opens a larger view. */
export default function ImageGrid({ images = [] }) {
  const [open, setOpen] = useState(null);
  if (!images.length) return null;
  const shown = images.slice(0, 4);
  return (
    <>
      <div className={`img-grid img-grid-${shown.length}`}>
        {shown.map((src, i) => (
          <button key={src} type="button" className="img-cell" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${images.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && (
        <Modal title="Photo" hideTitle size="lg" onClose={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[open]} alt="" className="lightbox-img" />
          {images.length > 1 && (
            <div className="lightbox-nav">
              <button className="btn btn-sm" onClick={() => setOpen((open - 1 + images.length) % images.length)}>Previous</button>
              <span className="small muted">{open + 1} / {images.length}</span>
              <button className="btn btn-sm" onClick={() => setOpen((open + 1) % images.length)}>Next</button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
