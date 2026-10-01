'use client';

import type { ReactNode } from 'react';

// Two-column layout shared by the contact and WBS blocks: info on the left, form on the right.
// `id` = key section kiri agar bisa jadi tujuan anchor menu (mis. /keberlanjutan#whistleblowing).
export default function ContactGrid({ left, right, id }: { left?: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section className="section-tight" id={id}>
      <div className="container">
        <div className="contact-grid">
          {left && <div className="contact-left">{left}</div>}
          {right && <div className="contact-right">{right}</div>}
        </div>
      </div>
    </section>
  );
}
