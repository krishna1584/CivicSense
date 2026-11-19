import { redirect } from 'next/navigation';

// Staff sign in through the same page as everyone else.
export default function AdminLoginPage() {
  redirect('/login');
}
