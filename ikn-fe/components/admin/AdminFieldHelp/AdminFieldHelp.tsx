'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/LanguageProvider';
import { findFieldHelp } from '@/lib/field-help';

// Tombol "?" di bawah setiap field form admin. Dipasang sekali di AdminShell dan memindai DOM (termasuk modal yang
// di-portal ke body) mencari `.field-label`; penjelasan diambil dari lib/field-help.ts menurut teks label + halaman.
// Node bantuan hanya ditambahkan di akhir kontainer field (setelah input, petunjuk, dan pesan error), jadi tidak
// mengganggu urutan elemen milik React. Field tanpa entri kamus tidak mendapat tombol.

const SCOPES = '.admin-app .field-label, .admin-modal-backdrop .field-label';
const SKIP = '.admin-toolbar, .admin-filter, .admin-search, .admin-tabs, .admin-tab-groups';
const CONTROLS = 'input, select, textarea, button, [contenteditable="true"]';

const helpNodes = new WeakMap<Element, HTMLDivElement>();

function labelText(el: Element): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    else if (node instanceof HTMLElement && !node.classList.contains('cms-req')) text += node.textContent ?? '';
  });
  return text;
}

function buildNode(title: string, text: string, lang: 'id' | 'en'): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'fhelp';
  wrap.dataset.fhelp = '1';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fhelp-btn';
  button.textContent = '?';
  button.setAttribute('aria-expanded', 'false');
  const body = document.createElement('p');
  body.className = 'fhelp-text';
  body.hidden = true;
  button.addEventListener('click', (event) => {
    // Tombol ada di dalam <label>: cegah fokus/klik diteruskan ke input.
    event.preventDefault();
    event.stopPropagation();
    body.hidden = !body.hidden;
    button.setAttribute('aria-expanded', String(!body.hidden));
    wrap.classList.toggle('is-open', !body.hidden);
  });
  wrap.append(button, body);
  fillNode(wrap, title, text, lang);
  return wrap;
}

function fillNode(wrap: HTMLDivElement, title: string, text: string, lang: 'id' | 'en') {
  const button = wrap.querySelector('button') as HTMLButtonElement;
  const body = wrap.querySelector('p') as HTMLParagraphElement;
  const aria = `${lang === 'en' ? 'Explain' : 'Penjelasan'}: ${title}`;
  if (button.getAttribute('aria-label') !== aria) {
    button.setAttribute('aria-label', aria);
    button.title = lang === 'en' ? 'What is this?' : 'Apa ini?';
  }
  if (body.textContent !== text) body.textContent = text;
}

function scan(pathname: string, lang: 'id' | 'en') {
  document.querySelectorAll(SCOPES).forEach((label) => {
    if (label.closest(SKIP)) return;
    const parent = label.parentElement;
    if (!parent) return;
    // ListField: label ada di kepala daftar → bantuan diletakkan tepat di bawah kepala.
    const isListHead = parent.classList.contains('cms-list-head');
    const container = isListHead ? parent.parentElement : parent;
    if (!container || !container.querySelector(CONTROLS)) return;

    const title = labelText(label).replace(/\*/g, '').trim();
    const help = findFieldHelp(title, pathname);
    const existing = helpNodes.get(label);
    if (!help) {
      existing?.remove();
      helpNodes.delete(label);
      return;
    }
    const text = help[lang] || help.id;
    if (existing && existing.isConnected) {
      fillNode(existing, title, text, lang);
      return;
    }
    const node = buildNode(title, text, lang);
    helpNodes.set(label, node);
    if (isListHead) parent.after(node);
    else container.append(node);
  });
}

export default function AdminFieldHelp() {
  const pathname = usePathname() || '';
  const { lang } = useLang();

  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      scan(pathname, lang);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(run);
    };
    schedule();
    const observer = new MutationObserver((records) => {
      // Abaikan perubahan yang hanya berasal dari node bantuan sendiri.
      if (records.every((r) => r.target instanceof Element && r.target.closest('[data-fhelp]'))) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname, lang]);

  return null;
}
