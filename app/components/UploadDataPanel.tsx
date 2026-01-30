/**
 * UploadDataPanel.tsx
 * 
 * Frontend component for the "Upload Data" feature.
 * Allows users to upload their own CSV data for confidential analysis.
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';

// Types
interface ValidationData {
  series: string[];
  row_count: number;
  date_status: 'detected' | 'sequential' | null;
  date_range: [string, string] | null;
  frequency: string | null;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: ValidationData | null;
}

interface SeriesWeight {
  name: string;
  weight: number;
  include: boolean;
}

interface UploadDataPanelProps {
  apiBase: string;
  onAnalysisComplete?: (html: string) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function UploadDataPanel({ apiBase, onAnalysisComplete }: UploadDataPanelProps) {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [seriesWeights, setSeriesWeights] = useState<SeriesWeight[]>([]);
  const [context, setContext] = useState('');
  const [includeAiMemo, setIncludeAiMemo] = useState(true);
  const [analysisName, setAnalysisName] = useState('Custom Analysis');
  
  const [isValidating, setIsValidating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlResult, setHtmlResult] = useState<string | null>(null);
  const [dataDeleted, setDataDeleted] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =============================================================================
  // FILE HANDLING
  // =============================================================================

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setValidation(null);
    setSeriesWeights([]);
    setError(null);
    setHtmlResult(null);
    setDataDeleted(false);
    
    // Validate the file
    setIsValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const res = await fetch(`${apiBase}/validate/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`Validation failed: ${res.statusText}`);
      }
      
      const result: ValidationResult = await res.json();
      setValidation(result);
      
      if (result.valid && result.data && result.data.series.length > 0) {
        // Initialize weights (all included with weight 1.0)
        setSeriesWeights(result.data.series.map(name => ({
          name,
          weight: 1.0,
          include: true,
        })));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to validate file');
    } finally {
      setIsValidating(false);
    }
  }, [apiBase]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  // =============================================================================
  // WEIGHT HANDLING
  // =============================================================================

  const updateWeight = useCallback((index: number, weight: number) => {
    setSeriesWeights(prev => prev.map((s, i) => 
      i === index ? { ...s, weight } : s
    ));
  }, []);

  const toggleInclude = useCallback((index: number) => {
    setSeriesWeights(prev => prev.map((s, i) => 
      i === index ? { ...s, include: !s.include } : s
    ));
  }, []);

  // =============================================================================
  // ANALYSIS
  // =============================================================================

  const runAnalysis = useCallback(async () => {
    if (!file || !validation?.valid) return;
    
    const activeWeights = seriesWeights.filter(s => s.include);
    if (activeWeights.length === 0) {
      setError('Please include at least one series');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    setDataDeleted(false);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('weights', JSON.stringify(
        Object.fromEntries(activeWeights.map(s => [s.name, s.weight]))
      ));
      formData.append('context', context);
      formData.append('include_ai_memo', String(includeAiMemo));
      formData.append('analysis_name', analysisName);
      
      const res = await fetch(`${apiBase}/analyze/custom`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errorData.detail || 'Analysis failed');
      }
      
      const html = await res.text();
      setHtmlResult(html);
      setDataDeleted(true);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(html);
      }
      
      // Scroll to results
      setTimeout(() => {
        document.getElementById('analysis-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, validation, seriesWeights, context, includeAiMemo, analysisName, apiBase, onAnalysisComplete]);

  // =============================================================================
  // RESET
  // =============================================================================

  const resetForm = useCallback(() => {
    setFile(null);
    setValidation(null);
    setSeriesWeights([]);
    setContext('');
    setAnalysisName('Custom Analysis');
    setError(null);
    setHtmlResult(null);
    setDataDeleted(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // =============================================================================
  // RENDER
  // =============================================================================

  // When showing results, use full width. Otherwise, narrow form layout.
  if (htmlResult) {
    return (
      <div style={styles.container}>
        {/* Page Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
            {analysisName}
          </h1>
          <p style={{ fontSize: 16, color: '#666', marginTop: 8 }}>
            Confidential analysis • Data not stored
          </p>
        </div>

        {/* Data Deleted Confirmation */}
        {dataDeleted && (
          <div style={styles.deletedConfirmation}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="#4ade80" strokeWidth="1.5"/>
              <path d="M7 10l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Your data has been deleted. Only the analysis results remain.</span>
          </div>
        )}
        
        {/* Report Card */}
        <div style={styles.reportContainer}>
          <div style={styles.reportHeader}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>Analysis Report</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={resetForm} style={styles.secondaryButton}>
                New Analysis
              </button>
              <button 
                onClick={() => {
                  const blob = new Blob([htmlResult], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${analysisName.replace(/\s+/g, '_')}_analysis.html`;
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
          </div>
          <iframe
            srcDoc={htmlResult}
            style={styles.reportIframe}
            title="Analysis Report"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.containerNarrow}>
      <div style={styles.header}>
        <h2 style={styles.title}>Upload Your Data</h2>
        <p style={styles.subtitle}>
          Analyze your own confidential time series. Data is processed in memory and deleted immediately after analysis.
        </p>
      </div>

      {/* Confidentiality Notice */}
      <div style={styles.confidentialNotice}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <path d="M10 1L3 5v4c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5l-7-4z" stroke="#4ade80" strokeWidth="1.5" fill="none"/>
          <path d="M7 10l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={styles.confidentialText}>
          <strong>Your data stays confidential</strong>
          <span style={{ display: 'block', fontSize: 12, marginTop: 2, opacity: 0.8 }}>
            Nothing is stored. Analysis runs in memory, results returned, data deleted.
          </span>
        </div>
      </div>

      {/* Template Download */}
      <div style={styles.templateSection}>
        <a 
          href={`${apiBase}/template/csv`} 
          download="bavella_template.csv"
          style={styles.templateLink}
        >
          Download CSV Template
        </a>
        <span style={{ color: '#666', fontSize: 12 }}>
          — Date column is optional. Delete it if you prefer not to disclose timing.
        </span>
      </div>

      {/* File Upload Area */}
      {!htmlResult && (
        <div
          style={{
            ...styles.dropZone,
            ...(file ? styles.dropZoneActive : {}),
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          
          {isValidating ? (
            <div style={styles.dropZoneContent}>
              <Spinner />
              <span style={{ marginTop: 12 }}>Validating file...</span>
            </div>
          ) : file ? (
            <div style={styles.dropZoneContent}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="#4ade80" strokeWidth="2"/>
              </svg>
              <span style={{ marginTop: 8, color: '#fff' }}>{file.name}</span>
              <span style={{ fontSize: 12, color: '#666' }}>Click to change file</span>
            </div>
          ) : (
            <div style={styles.dropZoneContent}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V8m0 0l-3 3m3-3l3 3" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 16.5V19a2 2 0 01-2 2H6a2 2 0 01-2-2v-2.5" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ marginTop: 12, color: '#888' }}>Drag & drop your file here</span>
              <span style={{ fontSize: 12, color: '#555' }}>or click to browse</span>
              <span style={{ fontSize: 11, color: '#444', marginTop: 8 }}>Accepts CSV, Excel (.xlsx)</span>
            </div>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {validation && !validation.valid && (
        <div style={styles.errorBox}>
          <strong>Validation Failed</strong>
          <ul style={{ marginTop: 8, marginLeft: 16 }}>
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Warnings */}
      {validation?.warnings && validation.warnings.length > 0 && (
        <div style={styles.warningBox}>
          <strong>Warnings</strong>
          <ul style={{ marginTop: 8, marginLeft: 16 }}>
            {validation.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Success - Configure Analysis */}
      {validation?.valid && validation?.data && !htmlResult && (
        <div style={styles.configSection}>
          {/* Data Summary */}
          <div style={styles.dataSummary}>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Observations</span>
              <span style={styles.summaryValue}>{validation.data.row_count.toLocaleString()}</span>
            </div>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Series</span>
              <span style={styles.summaryValue}>{validation.data.series.length}</span>
            </div>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Date Status</span>
              <span style={styles.summaryValue}>
                {validation.data.date_status === 'detected' ? '✓ Dates detected' : 'Sequential (no dates)'}
              </span>
            </div>
            {validation.data.date_range && (
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Date Range</span>
                <span style={styles.summaryValue}>{validation.data.date_range[0]} to {validation.data.date_range[1]}</span>
              </div>
            )}
            {validation.data.frequency && (
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Frequency</span>
                <span style={styles.summaryValue}>{validation.data.frequency}</span>
              </div>
            )}
          </div>

          {/* Series Weights */}
          <div style={styles.weightsSection}>
            <h3 style={styles.sectionTitle}>Configure Series Weights</h3>
            <p style={styles.sectionSubtitle}>
              Assign weights to combine series. Use negative weights for short positions.
            </p>
            
            <div style={styles.weightsTable}>
              <div style={styles.weightsHeader}>
                <span style={{ flex: 1 }}>Series</span>
                <span style={{ width: 100, textAlign: 'center' }}>Weight</span>
                <span style={{ width: 80, textAlign: 'center' }}>Include</span>
              </div>
              {seriesWeights.map((series, index) => (
                <div key={series.name} style={styles.weightsRow}>
                  <span style={{ flex: 1, color: series.include ? '#fff' : '#555' }}>
                    {series.name}
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={series.weight}
                    onChange={(e) => updateWeight(index, parseFloat(e.target.value) || 0)}
                    disabled={!series.include}
                    style={{
                      ...styles.weightInput,
                      opacity: series.include ? 1 : 0.3,
                    }}
                  />
                  <div style={{ width: 80, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={series.include}
                      onChange={() => toggleInclude(index)}
                      style={styles.checkbox}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis Options */}
          <div style={styles.optionsSection}>
            <h3 style={styles.sectionTitle}>Analysis Options</h3>
            
            <div style={styles.optionRow}>
              <label style={styles.optionLabel}>Analysis Name</label>
              <input
                type="text"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                placeholder="Custom Analysis"
                style={styles.textInput}
              />
            </div>
            
            <div style={styles.optionRow}>
              <label style={styles.optionLabel}>
                Context (optional)
                <span style={styles.optionHint}>Helps generate a more relevant memo</span>
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., Long/short equity strategy vs SPY"
                style={styles.textInput}
              />
            </div>
            
            <div style={styles.optionRow}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeAiMemo}
                  onChange={(e) => setIncludeAiMemo(e.target.checked)}
                  style={styles.checkbox}
                />
                <span>Generate AI Analysis Memo</span>
              </label>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing || seriesWeights.filter(s => s.include).length === 0}
            style={{
              ...styles.runButton,
              ...(isAnalyzing ? styles.runButtonDisabled : {}),
            }}
          >
            {isAnalyzing ? (
              <>
                <Spinner size={16} />
                <span style={{ marginLeft: 8 }}>Analyzing...</span>
              </>
            ) : (
              'Run Analysis'
            )}
          </button>
        </div>
      )}
      </div>{/* End containerNarrow */}
    </div>
  );
}

// =============================================================================
// SPINNER COMPONENT
// =============================================================================

function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="#333" strokeWidth="3" />
      <path d="M12 2a10 10 0 0110 10" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: 24,
  },
  containerNarrow: {
    maxWidth: 800,
    margin: '0 auto',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  confidentialNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    background: '#0a1a0a',
    border: '1px solid #1a3a1a',
    borderRadius: 8,
    marginBottom: 24,
  },
  confidentialText: {
    fontSize: 14,
    color: '#4ade80',
  },
  templateSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  templateLink: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontSize: 13,
  },
  dropZone: {
    border: '2px dashed #333',
    borderRadius: 8,
    padding: 40,
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: 24,
  },
  dropZoneActive: {
    borderColor: '#4ade80',
    background: '#0a1a0a',
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    color: '#888',
  },
  errorBox: {
    background: '#1a0a0a',
    border: '1px solid #3a1a1a',
    borderRadius: 8,
    padding: 16,
    color: '#f87171',
    marginBottom: 16,
    fontSize: 13,
  },
  warningBox: {
    background: '#1a1a0a',
    border: '1px solid #3a3a1a',
    borderRadius: 8,
    padding: 16,
    color: '#fbbf24',
    marginBottom: 16,
    fontSize: 13,
  },
  configSection: {
    background: '#141414',
    border: '1px solid #262626',
    borderRadius: 8,
    padding: 24,
  },
  dataSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 16,
    padding: 16,
    background: '#0a0a0a',
    borderRadius: 6,
    marginBottom: 24,
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
  },
  weightsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  weightsTable: {
    border: '1px solid #262626',
    borderRadius: 6,
    overflow: 'hidden',
  },
  weightsHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#0a0a0a',
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase' as const,
  },
  weightsRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderTop: '1px solid #262626',
    fontSize: 13,
  },
  weightInput: {
    width: 80,
    padding: '6px 8px',
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: 4,
    color: '#fff',
    textAlign: 'center' as const,
    fontSize: 13,
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: 'pointer',
  },
  optionsSection: {
    marginBottom: 24,
  },
  optionRow: {
    marginBottom: 16,
  },
  optionLabel: {
    display: 'block',
    fontSize: 13,
    color: '#888',
    marginBottom: 6,
  },
  optionHint: {
    display: 'block',
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  textInput: {
    width: '100%',
    padding: '10px 12px',
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#fff',
    fontSize: 14,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#888',
    cursor: 'pointer',
  },
  runButton: {
    width: '100%',
    padding: '14px 24px',
    background: '#2563eb',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease',
  },
  runButtonDisabled: {
    background: '#1e3a5f',
    cursor: 'not-allowed',
  },
  resultsSection: {
    marginTop: 24,
  },
  deletedConfirmation: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    background: '#0a1a0a',
    border: '1px solid #1a3a1a',
    borderRadius: 8,
    color: '#4ade80',
    fontSize: 13,
    marginBottom: 16,
  },
  reportContainer: {
    background: 'rgba(30, 42, 58, 0.5)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  reportHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportIframe: {
    width: '100%',
    height: '85vh',
    border: 'none',
    background: '#fff',
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
  resultsActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#888',
    fontSize: 14,
    cursor: 'pointer',
  },
  primaryButton: {
    padding: '10px 20px',
    background: '#2563eb',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default UploadDataPanel;
