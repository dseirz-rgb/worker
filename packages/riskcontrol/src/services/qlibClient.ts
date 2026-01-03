/**
 * Qlib Analytics Client
 * 
 * TypeScript client for Qlib Analytics Service API.
 */

// === Types ===

export interface VolatilityPrediction {
  ticker: string;
  horizon: number;
  predicted_volatility: number;
  confidence_lower: number;
  confidence_upper: number;
  model_version: string;
  timestamp: string;
}

export interface DrawdownProbability {
  ticker: string;
  horizon: number;
  threshold: number;
  probability: number;
  model_version: string;
  timestamp: string;
}

export interface MarketRegime {
  market: string;
  ticker: string;
  current_regime: 'bull' | 'bear' | 'sideways' | 'high_volatility';
  regime_probabilities: Record<string, number>;
  transition_probabilities: Record<string, number>;
  detected_at: string;
  model_version: string;
}

export interface TrainingJob {
  job_id: string;
  model_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  metrics: Record<string, number>;
  model_version: string;
  error: string | null;
}

export interface ModelVersion {
  model_type: string;
  version: string;
  created_at: string;
  metrics: Record<string, number>;
  is_active: boolean;
}

// === Config ===

const QLIB_API_URL = import.meta.env.VITE_QLIB_API_URL || 'http://localhost:6901';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${QLIB_API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// === API Functions ===

export async function predictVolatility(
  ticker: string,
  horizons: number[] = [1, 3, 5]
): Promise<VolatilityPrediction[]> {
  return request('/api/v1/predict/volatility', {
    method: 'POST',
    body: JSON.stringify({ ticker, horizons }),
  });
}

export async function predictDrawdown(
  ticker: string,
  horizons: number[] = [5, 10, 20],
  thresholds: number[] = [0.05, 0.10, 0.15]
): Promise<DrawdownProbability[]> {
  return request('/api/v1/predict/drawdown', {
    method: 'POST',
    body: JSON.stringify({ ticker, horizons, thresholds }),
  });
}

export async function getMarketRegime(
  market: string = 'us',
  ticker?: string
): Promise<MarketRegime> {
  const params = new URLSearchParams({ market });
  if (ticker) params.append('ticker', ticker);
  return request(`/api/v1/market/regime?${params}`);
}

export async function trainVolatilityModel(
  tickers: string[] = ['SPY', 'QQQ'],
  days: number = 504
): Promise<TrainingJob> {
  return request('/api/v1/training/volatility', {
    method: 'POST',
    body: JSON.stringify({ tickers, days }),
  });
}

export async function trainRegimeModel(
  tickers: string[] = ['SPY'],
  days: number = 756
): Promise<TrainingJob> {
  return request('/api/v1/training/regime', {
    method: 'POST',
    body: JSON.stringify({ tickers, days }),
  });
}

export async function getTrainingJobStatus(jobId: string): Promise<TrainingJob> {
  return request(`/api/v1/training/jobs/${jobId}`);
}

export async function checkQlibHealth(): Promise<{ status: string }> {
  return request('/health');
}
