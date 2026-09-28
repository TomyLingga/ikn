'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { isExternal, isProtocolLink } from './utils';

interface SmartLinkProps {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  newTab?: boolean;
}

// Internal paths use next/link; absolute URLs (files on the API host, external
// sites) open in a new tab; mailto:/tel: stay plain anchors.
export default function SmartLink({ href, className, style, children, newTab = false }: SmartLinkProps) {
  if (!href) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }
  if (isProtocolLink(href)) {
    return (
      <a href={href} className={className} style={style}>
        {children}
      </a>
    );
  }
  if (newTab || isExternal(href)) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
