import CheckoutSuccess from '@/components/CheckoutSuccess';

export function generateMetadata({ params }: { params: { number: string } }) {
  return { title: `Pesanan ${params.number}`, robots: { index: false, follow: false } };
}

export default function CheckoutSuccessPage({ params }: { params: { number: string } }) {
  return <CheckoutSuccess number={params.number} />;
}
