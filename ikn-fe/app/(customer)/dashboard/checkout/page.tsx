'use client';

// Checkout di dalam portal customer: halaman yang sama dengan /checkout; lib/shop.ts (useShopPaths) membuat
// kepala halaman, tautan, dan tujuan setelah pesanan dibuat mengikuti portal.
import CheckoutPage from '@/app/(site)/checkout/page';

export default function CustomerCheckoutPage() {
  return <CheckoutPage />;
}
