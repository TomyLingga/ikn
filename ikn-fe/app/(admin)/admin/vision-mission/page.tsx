import { redirect } from 'next/navigation';

// Legacy route: vision & mission is now a section of the "tentang" page.
export default function AdminVisionMissionRedirect() {
  redirect('/admin/pages/by-slug/tentang');
}
