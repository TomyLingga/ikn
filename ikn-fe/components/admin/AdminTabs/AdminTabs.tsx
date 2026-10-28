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
  /** Tab berkelompok (mis. "Perlu diproses" dan "Riwayat"): kelompok jadi tab map, status kelompok aktif tampil di panelnya. */
  groups?: AdminTabGroup<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}

// Tab status untuk daftar admin (Order, Pembayaran, Customer) bergaya tab map (folder): tab aktif menyatu dengan panel
// di bawahnya, toolbar pencarian berikutnya ditempelkan lewat CSS. Berkelompok: tab map = kelompok, status kelompok aktif
// tampil di panel. Angka = jumlah sepanjang waktu dari `meta.counts`; lencana merah hanya untuk status yang menunggu admin.
export default function AdminTabs<K extends string>({ tabs, groups, value, onChange, label }: AdminTabsProps<K>) {
  const renderTab = (tab: AdminTab<K>, className = 'admin-tab') => {
    const selected = tab.key === value;
    const count = tab.count ?? 0;
    return (
      <button key={tab.key} type="button" role="tab" aria-selected={selected} className={`${className}${selected ? ' is-active' : ''}`} onClick={() => onChange(tab.key)}>
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
    const active = groups.find((group) => group.tabs.some((tab) => tab.key === value)) ?? groups[0];
    return (
      <div className="admin-folder has-panel">
        <div className="admin-folder-tabs" role="tablist" aria-label={label}>
          {groups.map((group) => {
            const selected = group === active;
            const waiting = group.tabs.reduce((sum, tab) => sum + (tab.badge ? tab.count ?? 0 : 0), 0);
            // Membuka kelompok lain: status pertama yang menunggu admin, selain itu status pertama.
            const entry = (group.tabs.find((tab) => tab.badge && (tab.count ?? 0) > 0) ?? group.tabs[0])?.key;
            return (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`admin-folder-tab${selected ? ' is-active' : ''}`}
                // entry bisa '' (tab "Semua"), jadi cek undefined, bukan truthy.
                onClick={() => !selected && entry !== undefined && onChange(entry)}
              >
                <span>{group.label}</span>
                {waiting > 0 && <em className="admin-tab-badge">{waiting > 99 ? '99+' : waiting}</em>}
                {group.note && <small>{group.note}</small>}
              </button>
            );
          })}
        </div>
        {active && (
          <div className="admin-folder-panel">
            <div className="admin-tab-row" role="tablist" aria-label={active.label}>
              {active.tabs.map((tab) => renderTab(tab))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin-folder">
      <div className="admin-folder-tabs" role="tablist" aria-label={label}>
        {(tabs ?? []).map((tab) => renderTab(tab, 'admin-folder-tab'))}
      </div>
    </div>
  );
}
