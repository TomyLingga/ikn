import { Suspense } from 'react';
import CustomerOrders from '@/components/customer/CustomerOrders';

export const metadata = { title: 'Pesanan Saya' };

// Suspense: CustomerOrders membaca ?tab= lewat useSearchParams.
export default function CustomerOrdersPage() {
  return (
    <Suspense fallback={null}>
      <CustomerOrders />
    </Suspense>
  );
}
