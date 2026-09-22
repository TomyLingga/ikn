import { redirect } from 'next/navigation';

// Route registrasi customer — form-nya disatukan dengan halaman login.
export default function RegisterPage() {
  redirect('/login?mode=register');
}
