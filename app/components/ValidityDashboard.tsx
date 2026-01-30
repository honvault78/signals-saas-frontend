/**
 * Bavella Validity Dashboard — React Component
 * =============================================
 * 
 * Displays validity analysis results from the Bavella engine.
 * 
 * Integration:
 *   Import this component and use it alongside your existing analysis results.
 *   
 *   <ValidityDashboard validity={analysisResult.validity} />
 */

import React, { useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface FailureMode {
  failure_mode: string;
  name: string;
  description: string;
  severity: number;
  confidence: number;
  typically_reversible: boolean;
  evidence?: Record<string, any>;
}

interface Episode {
  episode_id: string;
  node_id: string;
  state: string;
  started_at: string;
  duration_days: number;
  root_cause_fm: string;
  root_cause_name: string;
  severity: {
    initial: number;
    min: number;
    current: number;
  };
}

interface RecoveryEstimate {
  estimated_days: number;
  confidence: number;
  distribution: {
    p25: number;
    p50: number;
    p75: number;
  };
  outcomes: {
    full_recovery: number;
    partial_recovery: number;
    rebaseline: number;
  };
  n_precedents: number;
}

interface ValiditySummary {
  validity_score: number;
  validity_state: 'valid' | 'degraded' | 'invalid';
  is_valid: boolean;
  fm_count: number;
  primary_fm: FailureMode | null;
  has_active_episode: boolean;
  episode_duration_days: number;
  estimated_recovery_days: number | null;
  regime: string;
  insights: string[];
}

interface ValidityFull {
  validity_score: number;
  validity_state: string;
  is_valid: boolean;
  detection: {
    active_fms: FailureMode[];
    primary_fm: FailureMode | null;
    overall_confidence: number;
    context: {
      regime: string;
      adf_pvalue: number;
      halflife: number;
      z_score: number;
    };
  };
  episode: Episode | null;
  episode_is_new: boolean;
  recovery_estimate: RecoveryEstimate | null;
  insights: string[];
  warnings: string[];
}

interface ValidityDashboardProps {
  validity: ValiditySummary;
  validityFull?: ValidityFull;
  onRefresh?: () => void;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function ValidityGauge({ score, state }: { score: number; state: string }) {
  const colors = {
    valid: { bg: 'rgba(0, 184, 148, 0.15)', fg: '#00b894', border: 'rgba(0, 184, 148, 0.3)' },
    degraded: { bg: 'rgba(243, 156, 18, 0.15)', fg: '#f39c12', border: 'rgba(243, 156, 18, 0.3)' },
    invalid: { bg: 'rgba(231, 76, 60, 0.15)', fg: '#e74c3c', border: 'rgba(231, 76, 60, 0.3)' },
  };
  
  const color = colors[state as keyof typeof colors] || colors.degraded;
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 24,
      background: color.bg,
      borderRadius: 16,
      border: `1px solid ${color.border}`,
    }}>
      <div style={{
        fontSize: 48,
        fontWeight: 700,
        color: color.fg,
        lineHeight: 1,
      }}>
        {score.toFixed(0)}
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: color.fg,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 8,
      }}>
        {state}
      </div>
      <div style={{
        width: '100%',
        height: 6,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        marginTop: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`,
          height: '100%',
          background: color.fg,
          borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function FailureModeCard({ fm, isPrimary }: { fm: FailureMode; isPrimary: boolean }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{
      padding: 16,
      background: isPrimary ? 'rgba(231, 76, 60, 0.1)' : 'rgba(255, 255, 255, 0.03)',
      borderRadius: 12,
      border: `1px solid ${isPrimary ? 'rgba(231, 76, 60, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
      cursor: 'pointer',
    }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '4px 8px',
              borderRadius: 4,
              background: 'rgba(231, 76, 60, 0.2)',
              color: '#e74c3c',
              fontSize: 11,
              fontWeight: 600,
            }}>
              {fm.failure_mode.split('_').slice(0, 2).join('')}
            </span>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
              {fm.name}
            </span>
            {isPrimary && (
              <span style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: '#e74c3c',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
              }}>
                PRIMARY
              </span>
            )}
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            {fm.description}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#e74c3c', fontWeight: 700, fontSize: 18 }}>
            {fm.severity.toFixed(0)}
          </div>
          <div style={{ color: '#666', fontSize: 11 }}>severity</div>
        </div>
      </div>
      
      {expanded && fm.evidence && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: 8,
          fontSize: 12,
          color: '#aaa',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff' }}>Evidence:</div>
          {Object.entries(fm.evidence).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{key}:</span>
              <span style={{ color: '#4fc3f7' }}>
                {typeof value === 'number' ? value.toFixed(4) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight, type }: { insight: string; type: 'info' | 'warning' }) {
  const isWarning = type === 'warning' || insight.includes('⚠️') || insight.includes('🔴');
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: 12,
      background: isWarning ? 'rgba(243, 156, 18, 0.1)' : 'rgba(79, 195, 247, 0.1)',
      borderRadius: 8,
      border: `1px solid ${isWarning ? 'rgba(243, 156, 18, 0.2)' : 'rgba(79, 195, 247, 0.2)'}`,
    }}>
      <span style={{ fontSize: 16 }}>{insight.charAt(0)}</span>
      <span style={{ color: '#fff', fontSize: 13, flex: 1 }}>{insight.slice(2).trim()}</span>
    </div>
  );
}

function RecoveryCard({ estimate }: { estimate: RecoveryEstimate }) {
  return (
    <div style={{
      padding: 20,
      background: 'rgba(79, 195, 247, 0.1)',
      borderRadius: 12,
      border: '1px solid rgba(79, 195, 247, 0.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: '#4fc3f7', fontWeight: 600, fontSize: 14 }}>Recovery Estimate</div>
        <div style={{ color: '#666', fontSize: 12 }}>
          Based on {estimate.n_precedents} similar episodes
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Best Case (p25)</div>
          <div style={{ color: '#00b894', fontWeight: 700, fontSize: 18 }}>{estimate.distribution.p25.toFixed(0)}d</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Expected (p50)</div>
          <div style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 24 }}>{estimate.distribution.p50.toFixed(0)}d</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Worst Case (p75)</div>
          <div style={{ color: '#f39c12', fontWeight: 700, fontSize: 18 }}>{estimate.distribution.p75.toFixed(0)}d</div>
        </div>
      </div>
      
      <div style={{ marginBottom: 8, color: '#888', fontSize: 11 }}>Outcome Probabilities</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: estimate.outcomes.full_recovery,
          padding: '8px 0',
          background: 'rgba(0, 184, 148, 0.3)',
          borderRadius: 4,
          textAlign: 'center',
          fontSize: 11,
          color: '#00b894',
        }}>
          Full {(estimate.outcomes.full_recovery * 100).toFixed(0)}%
        </div>
        <div style={{
          flex: estimate.outcomes.partial_recovery,
          padding: '8px 0',
          background: 'rgba(243, 156, 18, 0.3)',
          borderRadius: 4,
          textAlign: 'center',
          fontSize: 11,
          color: '#f39c12',
        }}>
          Partial {(estimate.outcomes.partial_recovery * 100).toFixed(0)}%
        </div>
        <div style={{
          flex: estimate.outcomes.rebaseline,
          padding: '8px 0',
          background: 'rgba(231, 76, 60, 0.3)',
          borderRadius: 4,
          textAlign: 'center',
          fontSize: 11,
          color: '#e74c3c',
        }}>
          Rebaseline {(estimate.outcomes.rebaseline * 100).toFixed(0)}%
        </div>
      </div>
      
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <span style={{ color: '#666', fontSize: 11 }}>
          Confidence: {(estimate.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ValidityDashboard({ 
  validity, 
  validityFull,
  onRefresh,
}: ValidityDashboardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div style={{
      background: 'rgba(30, 42, 58, 0.5)',
      borderRadius: 16,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>
            Validity Analysis
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            Epistemic validity of the analytical relationship
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'transparent',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          )}
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(79, 195, 247, 0.3)',
              background: 'rgba(79, 195, 247, 0.1)',
              color: '#4fc3f7',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div style={{ padding: 24 }}>
        {/* Top Row: Gauge + Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, marginBottom: 24 }}>
          <ValidityGauge 
            score={validity.validity_score} 
            state={validity.validity_state} 
          />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {/* Active Episode */}
            <div style={{
              padding: 16,
              background: validity.has_active_episode ? 'rgba(231, 76, 60, 0.1)' : 'rgba(0, 184, 148, 0.1)',
              borderRadius: 12,
              border: `1px solid ${validity.has_active_episode ? 'rgba(231, 76, 60, 0.2)' : 'rgba(0, 184, 148, 0.2)'}`,
            }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Episode Status</div>
              <div style={{
                color: validity.has_active_episode ? '#e74c3c' : '#00b894',
                fontWeight: 700,
                fontSize: 16,
              }}>
                {validity.has_active_episode ? 'ACTIVE' : 'None'}
              </div>
              {validity.has_active_episode && (
                <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                  {validity.episode_duration_days.toFixed(1)} days
                </div>
              )}
            </div>
            
            {/* Failure Modes */}
            <div style={{
              padding: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Failure Modes</div>
              <div style={{ color: validity.fm_count > 0 ? '#e74c3c' : '#00b894', fontWeight: 700, fontSize: 24 }}>
                {validity.fm_count}
              </div>
              {validity.primary_fm && (
                <div style={{ color: '#e74c3c', fontSize: 12, marginTop: 4 }}>
                  {validity.primary_fm.name}
                </div>
              )}
            </div>
            
            {/* Regime */}
            <div style={{
              padding: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Market Regime</div>
              <div style={{ color: '#4fc3f7', fontWeight: 600, fontSize: 14, textTransform: 'uppercase' }}>
                {validity.regime.replace(/_/g, ' ')}
              </div>
            </div>
            
            {/* Recovery Estimate */}
            <div style={{
              padding: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Est. Recovery</div>
              {validity.estimated_recovery_days !== null ? (
                <div style={{ color: '#f39c12', fontWeight: 700, fontSize: 24 }}>
                  {validity.estimated_recovery_days.toFixed(0)}d
                </div>
              ) : (
                <div style={{ color: '#00b894', fontWeight: 600, fontSize: 14 }}>
                  N/A
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Insights */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>INSIGHTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(validity.insights || []).map((insight, i) => (
              <InsightCard key={i} insight={insight} type="info" />
            ))}
          </div>
        </div>
        
        {/* Detailed View (Expandable) */}
        {showDetails && validityFull && (
          <>
            {/* Warnings */}
            {validityFull.warnings?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: '#f39c12', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>⚠️ WARNINGS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {validityFull.warnings.map((warning, i) => (
                    <InsightCard key={i} insight={warning} type="warning" />
                  ))}
                </div>
              </div>
            )}
            
            {/* Active Failure Modes */}
            {validityFull.detection?.active_fms?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: '#e74c3c', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                  ACTIVE FAILURE MODES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {validityFull.detection.active_fms.map((fm, i) => (
                    <FailureModeCard 
                      key={i} 
                      fm={fm} 
                      isPrimary={validityFull.detection.primary_failure_mode?.failure_mode === fm.failure_mode}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Recovery Estimate */}
            {validityFull.recovery_estimate && (
              <div style={{ marginBottom: 24 }}>
                <RecoveryCard estimate={validityFull.recovery_estimate} />
              </div>
            )}
            
            {/* Context */}
            {validityFull.detection?.context && (
            <div>
              <div style={{ color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>DETECTION CONTEXT</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                padding: 16,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 12,
              }}>
                <div>
                  <div style={{ color: '#666', fontSize: 11 }}>ADF p-value</div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{validityFull.detection.context.adf_pvalue?.toFixed(4) ?? 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: 11 }}>Half-life</div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{validityFull.detection.context.halflife?.toFixed(1) ?? 'N/A'} days</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: 11 }}>Z-Score</div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{validityFull.detection.context.z_score?.toFixed(2) ?? 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: 11 }}>Confidence</div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{validityFull.detection.overall_confidence ? (validityFull.detection.overall_confidence * 100).toFixed(0) : 'N/A'}%</div>
                </div>
              </div>
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT VERSION (for inline display)
// =============================================================================

export function ValidityBadge({ validity }: { validity: ValiditySummary }) {
  const colors = {
    valid: { bg: 'rgba(0, 184, 148, 0.2)', text: '#00b894' },
    degraded: { bg: 'rgba(243, 156, 18, 0.2)', text: '#f39c12' },
    invalid: { bg: 'rgba(231, 76, 60, 0.2)', text: '#e74c3c' },
  };
  
  const color = colors[validity.validity_state] || colors.degraded;
  
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      background: color.bg,
      borderRadius: 8,
    }}>
      <span style={{
        color: color.text,
        fontWeight: 700,
        fontSize: 16,
      }}>
        {validity.validity_score.toFixed(0)}
      </span>
      <span style={{
        color: color.text,
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        {validity.validity_state}
      </span>
      {validity.fm_count > 0 && (
        <span style={{
          color: '#e74c3c',
          fontSize: 11,
        }}>
          ({validity.fm_count} FM)
        </span>
      )}
    </div>
  );
}
