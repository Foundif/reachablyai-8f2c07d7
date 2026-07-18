import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function useInboxUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => { if (!user) setCount(0); }, [user]);
  return count;
}
