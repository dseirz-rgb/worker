/**
 * 投资管理页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { PortfolioCard } from '../components/investment/PortfolioCard';
import { PositionList } from '../components/investment/PositionList';
import {
  getPortfolioSummary,
  getPositions,
  getRiskControlConfig,
  setRiskControlConfig,
  clearRiskControlConfig,
  type PortfolioSummary,
  type Position,
} from '../services/riskcontrol';
import { RefreshCw, Settings, Check, X, Loader2 } from 'lucide-react';

export default function InvestmentPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  // 检查配置
  useEffect(() => {
    const config = getRiskControlConfig();
    if (config) {
      setApiUrl(config.apiUrl);
      setApiKey(config.apiKey);
      setIsConfigured(true);
      loadData();
    }
  }, []);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryResult, positionsResult] = await Promise.all([
        getPortfolioSummary(),
        getPositions(),
      ]);

      if (summaryResult.success && summaryResult.data) {
        setSummary(summaryResult.data);
      }
      if (positionsResult.success && positionsResult.data) {
        setPositions(positionsResult.data);
      }
    } catch (error) {
      console.error('加载投资数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const handleSaveConfig = () => {
    if (apiUrl && apiKey) {
      setRiskControlConfig({ apiUrl, apiKey });
      setIsConfigured(true);
      setShowConfig(false);
      loadData();
    }
  };

  // 清除配置
  const handleClearConfig = () => {
    clearRiskControlConfig();
    setApiUrl('');
    setApiKey('');
    setIsConfigured(false);
    setSummary(null);
    setPositions([]);
  };

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">投资管理</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          {isConfigured && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* 配置面板 */}
      {showConfig && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              RiskControl 配置
              {isConfigured && <Check className="h-4 w-4 text-green-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">API 地址</label>
              <Input
                placeholder="https://api.riskcontrol.example.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">API Key</label>
              <Input
                type="password"
                placeholder="your-api-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveConfig} disabled={!apiUrl || !apiKey}>
                保存
              </Button>
              {isConfigured && (
                <Button size="sm" variant="outline" onClick={handleClearConfig}>
                  <X className="h-4 w-4 mr-1" />
                  清除
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 未配置提示 */}
      {!isConfigured && !showConfig && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              请先配置 RiskControl API 以使用此功能
            </p>
            <Button onClick={() => setShowConfig(true)}>配置 API</Button>
          </CardContent>
        </Card>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 投资组合摘要 */}
      {isConfigured && !loading && summary && (
        <PortfolioCard summary={summary} />
      )}

      {/* 持仓列表 */}
      {isConfigured && !loading && positions.length > 0 && (
        <PositionList positions={positions} />
      )}
    </div>
  );
}
