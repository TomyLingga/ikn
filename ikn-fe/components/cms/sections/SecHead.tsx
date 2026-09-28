'use client';

import type { ReactNode } from 'react';
import Reveal from '@/components/Reveal';

interface SecHeadProps {
  label: string;
  heading: string;
  aside?: ReactNode;
  reveal?: boolean;
}

// Section heading block: eyebrow label + h2 (optionally split with a link on the right).
export default function SecHead({ label, heading, aside, reveal = true }: SecHeadProps) {
  const head = (
    <>
      {label && <span className="label label-amber">{label}</span>}
      {heading &&
        (reveal ? (
          <Reveal as="h2" className="h2 sec-head-title">
            {heading}
          </Reveal>
        ) : (
          <h2 className="h2 sec-head-title">{heading}</h2>
        ))}
    </>
  );

  if (aside) {
    return (
      <div className="sec-head sec-head-split">
        <div>{head}</div>
        {aside}
      </div>
    );
  }
  return <div className="sec-head">{head}</div>;
}
