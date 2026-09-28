import { redirect } from 'next/navigation';

// Legacy route: contact details are now sections of the "kontak" page.
export default function AdminContactRedirect() {
  redirect('/admin/pages/by-slug/kontak');
}
