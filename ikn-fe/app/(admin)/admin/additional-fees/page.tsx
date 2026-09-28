import { redirect } from 'next/navigation';

// Halaman lama; biaya tambahan kini bagian dari Pengaturan Checkout.
export default function AdditionalFeesRedirect() {
  redirect('/admin/checkout-settings');
}
