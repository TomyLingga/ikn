import { Suspense } from 'react';
import AdminOrders from '@/components/admin/AdminOrders';

export const metadata = { title: 'Order' };

// Suspense: AdminOrders membaca ?status= lewat useSearchParams (syarat App Router untuk render statis).
export default function AdminOrdersPage() {
  return (
    <Suspense fallback={null}>
      <AdminOrders />
    </Suspense>
  );
}
