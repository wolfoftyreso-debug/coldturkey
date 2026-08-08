'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '../components/Shell';
import { useSession } from '../lib/session';

export default function RootPage() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/home' : '/login');
  }, [user, loading, router]);

  return <Loading />;
}
