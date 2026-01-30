"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";

// =============================================================================
// DATABASE IMPORTS (from your hooks folder)
// =============================================================================
import {
  usePortfolios,
  useAnalyses,
  useAlerts,
  Position,
  Portfolio,
} from "../hooks/useDatabase";

// =============================================================================
// UPLOAD DATA COMPONENT
// =============================================================================
import UploadDataPanel from "./UploadDataPanel";

// =============================================================================
// VALIDITY DASHBOARD COMPONENT
// =============================================================================
import ValidityDashboard from "./ValidityDashboard";

// =============================================================================
// TYPES
// =============================================================================

type Candidate = {
  name: string;
  provider: string;
  provider_symbol: string;
  type: string;
  exchange?: string;
  currency?: string;
  confidence?: number;
};

type PositionRow = {
  id: string;
  query: string;
  resolvedSymbol: string | null;
  amount: number;
  candidates: Candidate[];
  loading: boolean;
  error: string | null;
};

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

type AnalysisAppProps = {
  authFetch: AuthFetch;
};

// Tabs: Markets (analysis), Upload Data, History
type TabId = 'analysis' | 'upload' | 'history';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.trim() || "http://localhost:8000";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// =============================================================================
// SPINNER COMPONENT
// =============================================================================

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// =============================================================================
// FORMAT HELPERS
// =============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// TOAST SYSTEM
// =============================================================================

type Toast = { id: string; type: 'success' | 'error' | 'info'; message: string };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            padding: '14px 20px',
            borderRadius: 10,
            background: toast.type === 'success' ? 'rgba(0, 184, 148, 0.95)' :
                       toast.type === 'error' ? 'rgba(231, 76, 60, 0.95)' :
                       'rgba(52, 73, 94, 0.95)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'slideIn 0.3s ease',
          }}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}
          >
            ✕
          </button>
        </div>
      ))}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

// =============================================================================
// PORTFOLIO TOOLBAR
// =============================================================================

interface PortfolioToolbarProps {
  portfolios: Portfolio[];
  loading: boolean;
  selectedId: string | null;
  onLoad: (portfolio: Portfolio) => void;
  onSave: () => void;
  onDelete: (id: string) => Promise<void>;
  canSave: boolean;
}

function PortfolioToolbar({ portfolios, loading, selectedId, onLoad, onSave, onDelete, canSave }: PortfolioToolbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this portfolio?')) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Load Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            minWidth: 180,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ flex: 1, textAlign: 'left' }}>
            {loading ? 'Loading...' : portfolios.find(p => p.id === selectedId)?.name || 'Load Portfolio'}
          </span>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {dropdownOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setDropdownOpen(false)} />
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'rgba(30, 42, 58, 0.98)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              overflow: 'hidden',
              zIndex: 50,
              maxHeight: 300,
              overflowY: 'auto',
            }}>
              {portfolios.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 13 }}>
                  No saved portfolios
                </div>
              ) : (
                portfolios.map(p => (
                  <div
                    key={p.id}
                    onClick={() => { onLoad(p); setDropdownOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: p.id === selectedId ? 'rgba(79, 195, 247, 0.1)' : 'transparent',
                    }}
                  >
                    <div>
                      <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                      <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                        {p.positions.length} position{p.positions.length !== 1 && 's'}
                        {p.is_default && <span style={{ color: '#f39c12', marginLeft: 8 }}>★ Default</span>}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      disabled={deletingId === p.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#666',
                        cursor: 'pointer',
                        padding: 6,
                        borderRadius: 6,
                      }}
                    >
                      {deletingId === p.id ? <Spinner size={14} /> : '✕'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={!canSave}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 10,
          border: 'none',
          background: canSave ? 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 100%)' : 'rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: canSave ? 'pointer' : 'not-allowed',
          opacity: canSave ? 1 : 0.5,
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        Save Portfolio
      </button>
    </div>
  );
}

// =============================================================================
// SAVE PORTFOLIO MODAL
// =============================================================================

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  defaultName: string;
  positionCount: number;
}

function SavePortfolioModal({ isOpen, onClose, onSave, defaultName, positionCount }: SaveModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setName(defaultName);
  }, [isOpen, defaultName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(180deg, #1e2a3a 0%, #0f1419 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 440,
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Save Portfolio</h3>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#888', fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>
              Portfolio Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter name..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                fontSize: 15,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#888', fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add notes..."
              rows={2}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>
          <div style={{ color: '#666', fontSize: 13 }}>
            {positionCount} position{positionCount !== 1 && 's'} will be saved
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!name.trim() || saving} style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !name.trim() ? 0.6 : 1,
          }}>
            {saving ? 'Saving...' : 'Save Portfolio'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SAVE ANALYSIS CARD
// =============================================================================

interface SaveAnalysisCardProps {
  onSave: () => Promise<void>;
  saving: boolean;
  saved: boolean;
}

function SaveAnalysisCard({ onSave, saving, saved }: SaveAnalysisCardProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      background: 'rgba(79, 195, 247, 0.1)',
      border: '1px solid rgba(79, 195, 247, 0.2)',
      borderRadius: 12,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" fill="none" stroke="#4fc3f7" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
        <span style={{ color: '#fff', fontSize: 14 }}>
          {saved ? 'Analysis saved to history!' : 'Save this analysis to your history?'}
        </span>
      </div>
      <button
        onClick={onSave}
        disabled={saving || saved}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 8,
          border: 'none',
          background: saved ? '#00b894' : 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 100%)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: saving || saved ? 'default' : 'pointer',
        }}
      >
        {saving ? <Spinner size={14} /> : saved ? '✓' : null}
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save to History'}
      </button>
    </div>
  );
}

// =============================================================================
// HISTORY PANEL
// =============================================================================

interface HistoryPanelProps {
  analyses: any[];
  loading: boolean;
  onView: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  viewingHtml: string | null;
  onCloseViewer: () => void;
}

function HistoryPanel({ analyses, loading, onView, onDelete, viewingHtml, onCloseViewer }: HistoryPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleView = async (id: string) => {
    setLoadingId(id);
    try {
      await onView(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analysis?')) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (viewingHtml) {
    return (
      <div style={{ marginTop: 24 }}>
        <button
          onClick={onCloseViewer}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          ← Back to History
        </button>
        <div style={{
          background: 'rgba(30, 42, 58, 0.5)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
        }}>
          <iframe srcDoc={viewingHtml} style={{ width: '100%', height: '85vh', border: 'none', background: '#fff' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: 0 }}>Analysis History</h2>
        <p style={{ color: '#666', fontSize: 14, marginTop: 4 }}>{analyses.length} saved analyses</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spinner size={32} />
        </div>
      ) : analyses.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 60,
          background: 'rgba(30, 42, 58, 0.5)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <svg width="48" height="48" fill="none" stroke="#444" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16 }}>
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
          </svg>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>No saved analyses</h3>
          <p style={{ color: '#666', fontSize: 14 }}>Run an analysis and save it to see it here</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {analyses.map(analysis => (
            <div
              key={analysis.id}
              style={{
                padding: 20,
                background: 'rgba(30, 42, 58, 0.5)',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{analysis.portfolio_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  <span style={{ color: '#666', fontSize: 13 }}>{formatDate(analysis.created_at)}</span>
                  <span style={{ color: '#666', fontSize: 13 }}>•</span>
                  <span style={{ color: '#666', fontSize: 13 }}>{analysis.analysis_period_days}d period</span>
                  {analysis.result_summary?.regime && (
                    <>
                      <span style={{ color: '#666', fontSize: 13 }}>•</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(79, 195, 247, 0.15)',
                        color: '#4fc3f7',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {analysis.result_summary.regime}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleView(analysis.id)}
                  disabled={loadingId === analysis.id}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {loadingId === analysis.id ? <Spinner size={14} /> : 'View'}
                </button>
                <button
                  onClick={() => handleDelete(analysis.id)}
                  disabled={deletingId === analysis.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'rgba(231, 76, 60, 0.15)',
                    color: '#e74c3c',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {deletingId === analysis.id ? <Spinner size={14} /> : '✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ALERTS PANEL
// =============================================================================

interface AlertsPanelProps {
  alerts: any[];
  loading: boolean;
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function getAlertColor(type: string) {
  switch (type) {
    case 'BUY_SIGNAL':
      return { bg: 'rgba(0, 184, 148, 0.1)', border: 'rgba(0, 184, 148, 0.3)', color: '#00b894' };
    case 'SELL_SIGNAL':
      return { bg: 'rgba(231, 76, 60, 0.1)', border: 'rgba(231, 76, 60, 0.3)', color: '#e74c3c' };
    case 'REGIME_CHANGE':
      return { bg: 'rgba(243, 156, 18, 0.1)', border: 'rgba(243, 156, 18, 0.3)', color: '#f39c12' };
    default:
      return { bg: 'rgba(79, 195, 247, 0.1)', border: 'rgba(79, 195, 247, 0.3)', color: '#4fc3f7' };
  }
}

function AlertsPanel({ alerts, loading, unreadCount, onMarkRead, onMarkAllRead, onDelete }: AlertsPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: 0 }}>Alerts</h2>
          <p style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: '#888',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spinner size={32} />
        </div>
      ) : alerts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 60,
          background: 'rgba(30, 42, 58, 0.5)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <svg width="48" height="48" fill="none" stroke="#444" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16 }}>
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
          </svg>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>No alerts yet</h3>
          <p style={{ color: '#666', fontSize: 14 }}>Enable tracking on portfolios to receive alerts</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {alerts.map(alert => {
            const colors = getAlertColor(alert.alert_type);
            return (
              <div
                key={alert.id}
                style={{
                  padding: 16,
                  background: colors.bg,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  opacity: alert.is_read ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      color: colors.color,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      {alert.alert_type.replace('_', ' ')}
                    </span>
                    <p style={{ color: '#fff', fontSize: 14, margin: '10px 0 6px' }}>{alert.message}</p>
                    <div style={{ color: '#666', fontSize: 12 }}>
                      {formatDate(alert.created_at)}
                      {alert.portfolio_name && ` • ${alert.portfolio_name}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!alert.is_read && (
                      <button
                        onClick={() => onMarkRead(alert.id)}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deletingId === alert.id}
                      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}
                    >
                      {deletingId === alert.id ? <Spinner size={12} /> : '✕'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AnalysisApp({ authFetch }: AnalysisAppProps) {
  // =============================================================================
  // STATE
  // =============================================================================
  
  // UPDATED: Default to 'analysis' tab
  const [activeTab, setActiveTab] = useState<TabId>('analysis');
  const [portfolioName, setPortfolioName] = useState("Long/Short Portfolio");
  const [days, setDays] = useState(180);
  const [rows, setRows] = useState<PositionRow[]>([
    { id: uid(), query: "", resolvedSymbol: null, amount: 1000000, candidates: [], loading: false, error: null },
    { id: uid(), query: "", resolvedSymbol: null, amount: -1000000, candidates: [], loading: false, error: null },
  ]);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>("");
  
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [analysisSaving, setAnalysisSaving] = useState(false);
  const [analysisSaved, setAnalysisSaved] = useState(false);
  const [viewingHistoryHtml, setViewingHistoryHtml] = useState<string | null>(null);
  
  // VALIDITY STATE
  const [validityData, setValidityData] = useState<any>(null);
  
  // AI MEMO TOGGLE
  const [includeAiMemo, setIncludeAiMemo] = useState(true);
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const abortRefs = useRef<Record<string, AbortController | null>>({});

  // =============================================================================
  // DATABASE HOOKS
  // =============================================================================
  
  const {
    portfolios,
    loading: portfoliosLoading,
    savePortfolio,
    deletePortfolio,
    refetch: refetchPortfolios,
  } = usePortfolios(authFetch);
  
  const {
    analyses,
    loading: analysesLoading,
    total: analysesTotal,
    saveAnalysis,
    getAnalysis,
    deleteAnalysis,
    refetch: refetchAnalyses,
  } = useAnalyses(authFetch);
  
  const {
    alerts,
    unreadCount,
    loading: alertsLoading,
    markAsRead,
    markAllAsRead,
    deleteAlert,
    refetch: refetchAlerts,
  } = useAlerts(authFetch);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const gross = useMemo(() => rows.reduce((s, r) => s + Math.abs(Number(r.amount || 0)), 0), [rows]);
  const net = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);
  const longExposure = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount || 0) > 0 ? Number(r.amount) : 0), 0), [rows]);
  const shortExposure = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount || 0) < 0 ? Math.abs(Number(r.amount)) : 0), 0), [rows]);
  
  const allResolved = rows.every(r => r.resolvedSymbol || Number(r.amount || 0) === 0);
  const hasPositions = rows.some(r => r.resolvedSymbol && Number(r.amount || 0) !== 0);
  
  const currentPositions: Position[] = rows
    .filter(r => r.resolvedSymbol && Number(r.amount || 0) !== 0)
    .map(r => ({ ticker: r.resolvedSymbol!, amount: Number(r.amount) }));

  // =============================================================================
  // TOAST HELPERS
  // =============================================================================
  
  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = uid();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // =============================================================================
  // ROW MANAGEMENT
  // =============================================================================

  function updateRow(id: string, patch: Partial<PositionRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: uid(), query: "", resolvedSymbol: null, amount: 0, candidates: [], loading: false, error: null },
    ]);
  }

  function removeRow(id: string) {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function resolveRow(id: string, q: string) {
    const query = q.trim();
    if (!query) {
      updateRow(id, { candidates: [], loading: false, error: null });
      return;
    }

    abortRefs.current[id]?.abort();
    const ac = new AbortController();
    abortRefs.current[id] = ac;

    updateRow(id, { loading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/resolve?q=${encodeURIComponent(query)}`, {
        signal: ac.signal,
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const cands = data.candidates || [];

      if (data.auto_selected && cands.length > 0) {
        updateRow(id, {
          resolvedSymbol: cands[0].provider_symbol,
          candidates: [],
          loading: false,
        });
      } else {
        updateRow(id, { candidates: cands, loading: false });
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        updateRow(id, { loading: false, error: e.message || "Search error" });
      }
    }
  }

  // =============================================================================
  // PORTFOLIO HANDLERS
  // =============================================================================

  const handleLoadPortfolio = useCallback((portfolio: Portfolio) => {
    setSelectedPortfolioId(portfolio.id);
    setPortfolioName(portfolio.name);
    setRows(
      portfolio.positions.map((p) => ({
        id: uid(),
        query: p.ticker,
        resolvedSymbol: p.ticker,
        amount: p.amount,
        candidates: [],
        loading: false,
        error: null,
      }))
    );
    setHtml("");
    setAnalysisSaved(false);
    showToast('success', `Loaded "${portfolio.name}"`);
  }, [showToast]);

  const handleSavePortfolio = useCallback(async (name: string, description: string) => {
    try {
      const saved = await savePortfolio(name, currentPositions, description);
      setSelectedPortfolioId(saved.id);
      showToast('success', `Portfolio "${name}" saved!`);
    } catch (e: any) {
      showToast('error', e.message || 'Failed to save portfolio');
    }
  }, [savePortfolio, currentPositions, showToast]);

  const handleDeletePortfolio = useCallback(async (id: string) => {
    try {
      await deletePortfolio(id);
      if (selectedPortfolioId === id) setSelectedPortfolioId(null);
      showToast('success', 'Portfolio deleted');
    } catch (e: any) {
      showToast('error', e.message || 'Failed to delete portfolio');
    }
  }, [deletePortfolio, selectedPortfolioId, showToast]);

  // =============================================================================
  // ANALYSIS HANDLERS
  // =============================================================================

  async function runAnalysis() {
    setRunError(null);
    setHtml("");
    setAnalysisSaved(false);
    setValidityData(null); // Reset validity

    const positions = rows
      .filter((r) => r.resolvedSymbol && Number(r.amount || 0) !== 0)
      .map((r) => ({ ticker: r.resolvedSymbol!, amount: Number(r.amount) }));

    if (positions.length === 0) {
      setRunError("Please add at least one position with a resolved ticker and amount.");
      return;
    }

    const bad = rows.find((r) => Number(r.amount || 0) !== 0 && !r.resolvedSymbol);
    if (bad) {
      setRunError("One or more positions has an amount but no selected ticker.");
      return;
    }

    const payload = {
      portfolio_name: portfolioName,
      analysis_period_days: Number(days || 180),
      include_ai_memo: includeAiMemo,
      positions,
    };

    setRunning(true);
    try {
      // Call /analyze to get JSON with validity data
      const res = await authFetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) throw new Error("Session expired. Please refresh.");
      if (res.status === 429) throw new Error("Rate limit exceeded. Please wait.");
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Analysis failed: ${txt || `HTTP ${res.status}`}`);
      }

      const data = await res.json();
      
      // Set HTML report
      setHtml(data.html_report || "");
      
      // Capture validity data
      if (data.validity) {
        setValidityData({
          ...data.validity,
          full: data.validity_full || null,
        });
      }

      setTimeout(() => {
        document.getElementById("report-section")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e: any) {
      setRunError(e?.message || "Failed to run analysis");
    } finally {
      setRunning(false);
    }
  }

  const handleSaveAnalysis = useCallback(async () => {
    setAnalysisSaving(true);
    try {
      await saveAnalysis(portfolioName, currentPositions, days, {}, html, {
        portfolio_id: selectedPortfolioId || undefined,
      });
      setAnalysisSaved(true);
      showToast('success', 'Analysis saved to history!');
    } catch (err) {
      showToast('error', 'Failed to save analysis');
    } finally {
      setAnalysisSaving(false);
    }
  }, [portfolioName, currentPositions, days, html, selectedPortfolioId, saveAnalysis, showToast]);

  const handleViewAnalysis = useCallback(async (id: string) => {
    const analysis = await getAnalysis(id);
    if (analysis.html_report) {
      setViewingHistoryHtml(analysis.html_report);
    }
  }, [getAnalysis]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent} className="header-content">
          <div style={styles.logoSection}>
            <img src="/logo.png" alt="Bavella" style={styles.logo} />
            <div style={styles.logoText}>
              <span style={styles.brandName}>BAVELLA</span>
              <span style={styles.brandTagline}>Quantitative Analytics</span>
            </div>
          </div>
          <nav style={styles.nav} className="nav">
            {/* Markets tab */}
            <button
              onClick={() => setActiveTab('analysis')}
              style={activeTab === 'analysis' ? styles.navLinkActive : styles.navLink}
            >
              Markets
            </button>
            {/* NEW: Upload Data tab */}
            <button
              onClick={() => setActiveTab('upload')}
              style={activeTab === 'upload' ? styles.navLinkActive : styles.navLink}
            >
              Upload Data
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                ...(activeTab === 'history' ? styles.navLinkActive : styles.navLink),
                position: 'relative',
              }}
            >
              History
              {analysesTotal > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#4fc3f7',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 10,
                }}>
                  {analysesTotal}
                </span>
              )}
            </button>
            
            <div style={styles.userButton}>
              <UserButton afterSignOutUrl="/" />
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.container}>
          
          {/* ============================================= */}
          {/* PUBLIC EQUITIES TAB (formerly "Analysis") */}
          {/* ============================================= */}
          {activeTab === 'analysis' && (
            <>
              {/* Page Header with Portfolio Toolbar */}
              <div style={{ ...styles.pageHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }} className="page-header">
                <div>
                  <h1 style={styles.pageTitle} className="page-title">Markets</h1>
                  <p style={styles.pageSubtitle}>
                    Build and analyze portfolios with regime-aware validity diagnostics
                  </p>
                </div>
                <PortfolioToolbar
                  portfolios={portfolios}
                  loading={portfoliosLoading}
                  selectedId={selectedPortfolioId}
                  onLoad={handleLoadPortfolio}
                  onSave={() => setSaveModalOpen(true)}
                  onDelete={handleDeletePortfolio}
                  canSave={currentPositions.length > 0}
                />
              </div>

              {/* Configuration Card */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>Configuration</h2>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.configGrid} className="config-grid">
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Portfolio Name</label>
                      <input
                        value={portfolioName}
                        onChange={(e) => setPortfolioName(e.target.value)}
                        placeholder="Enter portfolio name"
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Analysis Period</label>
                      <div style={styles.selectWrapper}>
                        <select
                          value={days}
                          onChange={(e) => setDays(Number(e.target.value))}
                          style={styles.select}
                        >
                          <option value={30}>30 Days</option>
                          <option value={60}>60 Days</option>
                          <option value={90}>90 Days</option>
                          <option value={180}>6 Months</option>
                          <option value={365}>1 Year</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Exposure Summary */}
              <div style={styles.exposureGrid} className="exposure-grid">
                <div style={styles.exposureCard}>
                  <div style={styles.exposureLabel}>Long Exposure</div>
                  <div style={{ ...styles.exposureValue, color: '#00b894' }} className="exposure-value">
                    {formatCurrency(longExposure)}
                  </div>
                </div>
                <div style={styles.exposureCard}>
                  <div style={styles.exposureLabel}>Short Exposure</div>
                  <div style={{ ...styles.exposureValue, color: '#e74c3c' }} className="exposure-value">
                    {formatCurrency(shortExposure)}
                  </div>
                </div>
                <div style={styles.exposureCard}>
                  <div style={styles.exposureLabel}>Gross Exposure</div>
                  <div style={styles.exposureValue} className="exposure-value">{formatCurrency(gross)}</div>
                </div>
                <div style={styles.exposureCard}>
                  <div style={styles.exposureLabel}>Net Exposure</div>
                  <div style={{ ...styles.exposureValue, color: net >= 0 ? '#00b894' : '#e74c3c' }} className="exposure-value">
                    {formatCurrency(net)}
                  </div>
                </div>
              </div>

              {/* Positions Card */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>Portfolio Positions</h2>
                  <button onClick={addRow} style={styles.addButton}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Position
                  </button>
                </div>
                <div style={styles.cardBody}>
                  {/* Table Header */}
                  <div style={styles.tableHeader} className="table-header">
                    <div style={styles.tableHeaderCell}>Instrument</div>
                    <div style={styles.tableHeaderCell}>Amount (USD)</div>
                    <div style={styles.tableHeaderCell}>Direction</div>
                    <div style={styles.tableHeaderCell}>Status</div>
                    <div style={styles.tableHeaderCell}></div>
                  </div>

                  {/* Rows */}
                  {rows.map((row) => {
                    const amt = Number(row.amount || 0);
                    const direction = amt > 0 ? "LONG" : amt < 0 ? "SHORT" : "—";
                    const dirColor = amt > 0 ? "#00b894" : amt < 0 ? "#e74c3c" : "#666";

                    return (
                      <div key={row.id} style={styles.tableRow} className="table-row">
                        {/* Instrument Cell */}
                        <div style={styles.tableCell}>
                          <input
                            value={row.query}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRow(row.id, { query: val, resolvedSymbol: null, candidates: [], error: null });
                            }}
                            onBlur={() => resolveRow(row.id, row.query)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") resolveRow(row.id, row.query);
                            }}
                            placeholder="Ticker or company name"
                            style={styles.tickerInput}
                          />
                          {row.loading && (
                            <div style={styles.searchingIndicator}>
                              <Spinner size={14} /> Searching...
                            </div>
                          )}
                          {row.error && <div style={styles.errorText}>{row.error}</div>}
                          {row.candidates.length > 0 && !row.resolvedSymbol && (
                            <div style={styles.candidatesList}>
                              {row.candidates.map((c) => (
                                <button
                                  key={c.provider_symbol}
                                  onClick={() => {
                                    updateRow(row.id, {
                                      resolvedSymbol: c.provider_symbol,
                                      query: c.provider_symbol,
                                      candidates: [],
                                    });
                                  }}
                                  style={styles.candidateButton}
                                >
                                  <span style={styles.candidateSymbol}>{c.provider_symbol}</span>
                                  <span style={styles.candidateName}>{c.name}</span>
                                  <span style={styles.candidateMeta}>
                                    {c.exchange} {c.currency && `• ${c.currency}`}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Amount Cell */}
                        <div>
                          <input
                            type="number"
                            value={row.amount || ""}
                            onChange={(e) => updateRow(row.id, { amount: Number(e.target.value) || 0 })}
                            placeholder="0"
                            style={styles.amountInput}
                          />
                        </div>

                        {/* Direction Cell */}
                        <div>
                          <span
                            style={{
                              ...styles.directionBadge,
                              background: `${dirColor}20`,
                              color: dirColor,
                            }}
                          >
                            {direction}
                          </span>
                        </div>

                        {/* Status Cell */}
                        <div>
                          {row.resolvedSymbol ? (
                            <div style={styles.resolvedStatus}>
                              <svg width="16" height="16" fill="none" stroke="#00b894" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              <span style={styles.resolvedSymbol}>{row.resolvedSymbol}</span>
                            </div>
                          ) : (
                            <span style={styles.pendingStatus}>
                              {row.query ? "Select ticker" : "Enter ticker"}
                            </span>
                          )}
                        </div>

                        {/* Remove Button */}
                        <div>
                          <button
                            onClick={() => removeRow(row.id)}
                            disabled={rows.length <= 2}
                            style={{
                              ...styles.removeButton,
                              opacity: rows.length <= 2 ? 0.3 : 1,
                              cursor: rows.length <= 2 ? "not-allowed" : "pointer",
                            }}
                          >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Banner */}
              {runError && (
                <div style={styles.errorBanner}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {runError}
                </div>
              )}

              {/* Run Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#888', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={includeAiMemo}
                    onChange={(e) => setIncludeAiMemo(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  Include Memo
                </label>
              </div>
              <button
                onClick={runAnalysis}
                disabled={running || !allResolved || !hasPositions}
                style={{
                  ...styles.runButton,
                  opacity: running || !allResolved || !hasPositions ? 0.6 : 1,
                  cursor: running || !allResolved || !hasPositions ? "not-allowed" : "pointer",
                }}
              >
                {running ? (
                  <>
                    <Spinner size={20} />
                    Running Analysis...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Run Analysis
                  </>
                )}
              </button>

              {/* Report Section */}
              {html && (
                <div id="report-section">
                  <SaveAnalysisCard
                    onSave={handleSaveAnalysis}
                    saving={analysisSaving}
                    saved={analysisSaved}
                  />
                  <div style={styles.reportCard}>
                    <div style={styles.reportHeader}>
                      <h2 style={styles.cardTitle}>Analysis Report</h2>
                      <button
                        onClick={() => {
                          const blob = new Blob([html], { type: "text/html" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${portfolioName.replace(/\s+/g, "_")}_analysis.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={styles.downloadButton}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Report
                      </button>
                    </div>
                    <iframe srcDoc={html} style={styles.reportIframe} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================= */}
          {/* UPLOAD DATA TAB (NEW) */}
          {/* ============================================= */}
          {activeTab === 'upload' && (
            <UploadDataPanel 
              apiBase={API_BASE}
              onAnalysisComplete={(html) => {
                showToast('success', 'Analysis complete!');
              }}
            />
          )}

          {/* ============================================= */}
          {/* HISTORY TAB */}
          {/* ============================================= */}
          {activeTab === 'history' && (
            <HistoryPanel
              analyses={analyses}
              loading={analysesLoading}
              onView={handleViewAnalysis}
              onDelete={deleteAnalysis}
              viewingHtml={viewingHistoryHtml}
              onCloseViewer={() => setViewingHistoryHtml(null)}
            />
          )}

        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent} className="footer-content">
          <div style={styles.footerBrand}>
            <span style={styles.footerLogo}>BAVELLA</span>
            <span style={styles.footerTagline}>Quantitative Analytics</span>
          </div>
          <div style={styles.footerLinks}>
            <a href="/documentation.html" style={styles.footerLink}>Documentation</a>
            <a href="mailto:support@bavella-technologies.com" style={styles.footerLink}>Support</a>
            <a href="/privacy.html" style={styles.footerLink}>Privacy</a>
          </div>
          <span style={styles.footerCopyright}>© 2026 Bavella Technologies Sarl</span>
        </div>
      </footer>

      {/* Save Portfolio Modal */}
      <SavePortfolioModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSavePortfolio}
        defaultName={portfolioName}
        positionCount={currentPositions.length}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
  },
  header: {
    background: 'rgba(15, 15, 26, 0.95)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  headerContent: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 18,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 10,
    color: '#4fc3f7',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  navLink: {
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: '#888',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative' as const,
  },
  navLinkActive: {
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: 'rgba(79, 195, 247, 0.1)',
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    position: 'relative' as const,
  },
  userButton: {
    marginLeft: 8,
  },
  main: {
    flex: 1,
    padding: '32px 24px',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  pageHeader: {
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  card: {
    background: 'rgba(30, 42, 58, 0.5)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
    margin: 0,
  },
  cardBody: {
    padding: 24,
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 24,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(0, 0, 0, 0.2)',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
  },
  selectWrapper: { position: 'relative' as const },
  select: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(0, 0, 0, 0.2)',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none' as const,
  },
  exposureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  exposureCard: {
    background: 'rgba(30, 42, 58, 0.5)',
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '20px 24px',
    textAlign: 'center' as const,
  },
  exposureLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  exposureValue: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 100px 140px 50px',
    gap: 16,
    padding: '12px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: 600,
    color: '#4fc3f7',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 100px 140px 50px',
    gap: 16,
    padding: '16px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    alignItems: 'start',
  },
  tableCell: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  tickerInput: {
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(0, 0, 0, 0.2)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  },
  amountInput: {
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(0, 0, 0, 0.2)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    textAlign: 'right' as const,
  },
  searchingIndicator: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#888' },
  errorText: { fontSize: 12, color: '#e74c3c' },
  candidatesList: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  candidateButton: {
    width: '100%',
    padding: '12px 14px',
    border: 'none',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    transition: 'background 0.2s',
    textAlign: 'left' as const,
  },
  candidateSymbol: { fontWeight: 700, color: '#4fc3f7', fontSize: 13, minWidth: 70 },
  candidateName: { color: '#fff', fontSize: 13, flex: 1 },
  candidateMeta: { color: '#666', fontSize: 11 },
  directionBadge: {
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    display: 'inline-block',
  },
  resolvedStatus: { display: 'flex', alignItems: 'center', gap: 8 },
  resolvedSymbol: { color: '#00b894', fontWeight: 600, fontSize: 14 },
  pendingStatus: { color: '#666', fontSize: 13 },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid rgba(79, 195, 247, 0.3)',
    background: 'rgba(79, 195, 247, 0.1)',
    color: '#4fc3f7',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  removeButton: {
    padding: 8,
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#666',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    borderRadius: 12,
    background: 'rgba(231, 76, 60, 0.15)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    color: '#e74c3c',
    fontSize: 14,
    marginBottom: 24,
  },
  runButton: {
    width: '100%',
    padding: '18px 24px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    transition: 'all 0.2s',
    boxShadow: '0 4px 20px rgba(0, 184, 148, 0.3)',
    marginBottom: 32,
  },
  reportCard: {
    background: 'rgba(30, 42, 58, 0.5)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  reportHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  downloadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'transparent',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  reportIframe: {
    width: '100%',
    height: '85vh',
    border: 'none',
    background: '#fff',
  },
  footer: {
    background: 'rgba(15, 15, 26, 0.95)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '40px 24px',
    marginTop: 'auto',
  },
  footerContent: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 24,
  },
  footerBrand: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  footerLogo: { fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 2 },
  footerTagline: { fontSize: 12, color: '#666' },
  footerLinks: { display: 'flex', gap: 24 },
  footerLink: { color: '#888', textDecoration: 'none', fontSize: 13, transition: 'color 0.2s' },
  footerCopyright: { fontSize: 12, color: '#666' },
};
