'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
import type { DashboardData } from './me-types';

export const DASH_KEY = ['me', 'dashboard'] as const;

/** Shared beneficiary dashboard payload; every dashboard page reads from this one cache entry. */
export function useDashboard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: DASH_KEY,
    queryFn: () => api<DashboardData>('/api/me/dashboard'),
    enabled: user?.role === 'BENEFICIARY',
    staleTime: 10_000,
  });
}

export function useRefreshDashboard() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: DASH_KEY });
}

export const errMsg = (e: unknown, fallback = 'Something went wrong. Please try again.') =>
  e instanceof Error && e.message ? e.message : fallback;
