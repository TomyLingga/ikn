'use client';

import type { ReactNode } from 'react';

// Two-column layout shared by the contact and WBS pages: info on the left, form on the right.
export default function ContactGrid({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <section className="section-tight">
      <div className="container">
        <div className="contact-grid">
          {left && <div className="contact-left">{left}</div>}
          {right && <div className="contact-right">{right}</div>}
        </div>
      </div>
    </section>
  );
}
