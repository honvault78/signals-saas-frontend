/**
 * Database API Hooks
 * Place in: frontend/app/hooks/useDatabase.ts
 */

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface Position {
  ticker: string;
  amount: number;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  positions: Position[];
  is_default: boolean;
  is_tracked: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalysisSummary {
  id: string;
  user_id: string;
  portfolio_id: string | null;
  portfolio_name: string;
  positions: Position[];
  analysis_period_days: number;
  result_summary: {
    regime?: string;
    signal?: string;
    trend_score?: number;
    z_score?: number;
    rsi?: number;
    cumulative_return?: number;
  };
  duration_ms: number | null;
  created_at: string;
  has_html_report: boolean;
  has_ai_memo: boolean;
}

export interface AnalysisFull extends AnalysisSummary {
  html_report: string | null;
  ai_memo: string | null;
}

export interface Alert {
  id: string;
  user_id: string;
  portfolio_id: string;
  portfolio_name: string | null;
  alert_type: 'buy' | 'sell' | 'regime_change' | 'drawdown' | 'zscore_extreme';
  severity: 'info' | 'warning' | 'critical';
  signal_date: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || 'http://localhost:8000';

// =============================================================================
// PORTFOLIOS HOOK
// =============================================================================

export function usePortfolios(authFetch: AuthFetch) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/api/portfolios`);
      if (!res.ok) throw new Error('Failed to fetch portfolios');
      const data = await res.json();
      setPortfolios(data.portfolios || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const savePortfolio = useCallback(async (
    name: string,
    positions: Position[],
    options?: { description?: string; is_default?: boolean; is_tracked?: boolean }
  ): Promise<Portfolio> => {
    const res = await authFetch(`${API_BASE}/api/portfolios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        positions,
        description: options?.description || null,
        is_default: options?.is_default || false,
        is_tracked: options?.is_tracked ?? true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save portfolio');
    }
    const portfolio = await res.json();
    setPortfolios(prev => [portfolio, ...prev]);
    return portfolio;
  }, [authFetch]);

  const deletePortfolio = useCallback(async (id: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/api/portfolios/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete portfolio');
    }
    setPortfolios(prev => prev.filter(p => p.id !== id));
  }, [authFetch]);

  return {
    portfolios,
    loading,
    error,
    refetch: fetchPortfolios,
    savePortfolio,
    deletePortfolio,
  };
}

// =============================================================================
// ANALYSES HOOK
// =============================================================================

export function useAnalyses(authFetch: AuthFetch) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchAnalyses = useCallback(async (
    options?: { portfolio_id?: string; limit?: number; offset?: number }
  ) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options?.portfolio_id) params.set('portfolio_id', options.portfolio_id);
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());
      
      const url = `${API_BASE}/api/analyses${params.toString() ? '?' + params : ''}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed to fetch analyses');
      const data = await res.json();
      setAnalyses(data.analyses || []);
      setTotal(data.total || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const saveAnalysis = useCallback(async (
    portfolioName: string,
    positions: Position[],
    analysisPeriodDays: number,
    resultSummary: Record<string, unknown>,
    htmlReport: string,
    options?: { ai_memo?: string; duration_ms?: number; portfolio_id?: string }
  ): Promise<AnalysisSummary> => {
    const res = await authFetch(`${API_BASE}/api/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolio_name: portfolioName,
        positions,
        analysis_period_days: analysisPeriodDays,
        result_summary: resultSummary,
        html_report: htmlReport,
        ai_memo: options?.ai_memo || null,
        duration_ms: options?.duration_ms || null,
        portfolio_id: options?.portfolio_id || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save analysis');
    }
    const analysis = await res.json();
    setAnalyses(prev => [analysis, ...prev]);
    setTotal(prev => prev + 1);
    return analysis;
  }, [authFetch]);

  const getAnalysis = useCallback(async (id: string): Promise<AnalysisFull> => {
    const res = await authFetch(`${API_BASE}/api/analyses/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch analysis');
    }
    return res.json();
  }, [authFetch]);

  const deleteAnalysis = useCallback(async (id: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/api/analyses/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete analysis');
    }
    setAnalyses(prev => prev.filter(a => a.id !== id));
    setTotal(prev => prev - 1);
  }, [authFetch]);

  return {
    analyses,
    loading,
    error,
    total,
    refetch: fetchAnalyses,
    saveAnalysis,
    getAnalysis,
    deleteAnalysis,
  };
}

// =============================================================================
// ALERTS HOOK
// =============================================================================

export function useAlerts(authFetch: AuthFetch) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async (options?: { unread_only?: boolean }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options?.unread_only) params.set('unread_only', 'true');
      
      const url = `${API_BASE}/api/alerts${params.toString() ? '?' + params : ''}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      setAlerts(data.alerts || []);
      setUnreadCount(data.unread_count || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markAsRead = useCallback(async (id: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    });
    if (!res.ok) throw new Error('Failed to mark alert as read');
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [authFetch]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    const res = await authFetch(`${API_BASE}/api/alerts/mark-all-read`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to mark all alerts as read');
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    setUnreadCount(0);
  }, [authFetch]);

  const deleteAlert = useCallback(async (id: string): Promise<void> => {
    const res = await authFetch(`${API_BASE}/api/alerts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete alert');
    const wasUnread = alerts.find(a => a.id === id)?.is_read === false;
    setAlerts(prev => prev.filter(a => a.id !== id));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
  }, [authFetch, alerts]);

  return {
    alerts,
    unreadCount,
    loading,
    error,
    refetch: fetchAlerts,
    markAsRead,
    markAllAsRead,
    deleteAlert,
  };
}
