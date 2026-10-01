import { Suspense } from 'react';
import CustomerOrderDetail from '@/components/customer/CustomerOrderDetail';

export function generateMetadata({ params }: { params: { number: string } }) {
  return { title: `Pesanan ${params.number}` };
}

// Suspense: CustomerOrderDetail membaca ?placed=1 (baru selesai checkout) lewat useSearchParams.
export default function CustomerOrderDetailPage({ params }: { params: { number: string } }) {
  return (
    <Suspense fallback={null}>
      <CustomerOrderDetail number={params.number} />
    </Suspense>
  );
}
