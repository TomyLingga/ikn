import { redirect } from 'next/navigation';

// Legacy route: company history is now a section of the "tentang" page.
export default function AdminHistoryRedirect() {
  redirect('/admin/pages/by-slug/tentang');
}
