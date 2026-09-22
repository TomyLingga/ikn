import CustomerOrderDetail from '@/components/customer/CustomerOrderDetail';

export function generateMetadata({ params }: { params: { number: string } }) {
  return { title: `Pesanan ${params.number}` };
}

export default function CustomerOrderDetailPage({ params }: { params: { number: string } }) {
  return <CustomerOrderDetail number={params.number} />;
}
