'use client';

import Icon from '@/components/Icon';
import type { IconName } from '@/lib/types';

export interface AdminTab<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
  /** Jumlah baris sepanjang waktu; tampil sebagai lencana bila `badge` (antrean kerja) atau sebagai angka redup. */
  count?: number;
  badge?: boolean;
}

export interface AdminTabGroup<K extends string> {
  key: string;
  label: string;
  /** Keterangan pendek di samping judul kelompok, mis. "dengan filter tanggal". */
  note?: string;
  tabs: AdminTab<K>[];
}

interface AdminTabsProps<K extends string> {
  /** Satu baris tab tanpa kelompok. */
  tabs?: AdminTab<K>[];
  /** Tab berkelompok (mis. "Perlu diproses" dan "Riwayat"); tiap kelompok satu baris yang bisa digeser di layar sempit. */
  groups?: AdminTabGroup<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}

// Tab status untuk daftar admin (Order, Pembayaran, Customer): sama dengan tab "Pesanan saya" di portal.
// Angka tab = jumlah sepanjang waktu dari `meta.counts`; lencana merah hanya untuk status yang menunggu admin.
export default function AdminTabs<K extends string>({ tabs, groups, value, onChange, label }: AdminTabsProps<K>) {
  const renderTab = (tab: AdminTab<K>) => {
    const selected = tab.key === value;
    const count = tab.count ?? 0;
    return (
      <button key={tab.key} type="button" role="tab" aria-selected={selected} className={`admin-tab${selected ? ' is-active' : ''}`} onClick={() => onChange(tab.key)}>
        {tab.icon && <Icon name={tab.icon} size={16} />}
        <span>{tab.label}</span>
        {tab.badge && count > 0 ? (
          <em className="admin-tab-badge">{count > 99 ? '99+' : count}</em>
        ) : tab.count !== undefined ? (
          <small className="admin-tab-count">{count}</small>
        ) : null}
      </button>
    );
  };

  if (groups && groups.length > 0) {
    return (
      <div className="admin-tab-groups" role="tablist" aria-label={label}>
        {groups.map((group) => (
          <div key={group.key} className="admin-tab-group">
            <span className="admin-tab-group-label">
              {group.label}
              {group.note && <small>{group.note}</small>}
            </span>
            <div className="admin-tab-row">{group.tabs.map(renderTab)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="admin-tabs" role="tablist" aria-label={label}>
      {(tabs ?? []).map(renderTab)}
    </div>
  );
}
