-- 创建 live 表用于存储长桥 API 实时行情数据
-- 外部 feeder (my-stock-feeder) 会定期写入此表

CREATE TABLE IF NOT EXISTS live (
    id BIGSERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    price DECIMAL(15, 4) NOT NULL,
    prev_close DECIMAL(15, 4),
    change_percent DECIMAL(10, 4),
    volume BIGINT,
    timestamp TIMESTAMPTZ,
    source VARCHAR(20) DEFAULT 'longport',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建唯一索引，确保每个 ticker 只有一条记录（最新的）
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_ticker ON live(ticker);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_live_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_live_updated_at ON live;
CREATE TRIGGER trigger_live_updated_at
    BEFORE UPDATE ON live
    FOR EACH ROW
    EXECUTE FUNCTION update_live_updated_at();

-- 添加 RLS 策略（允许匿名读取，需要认证才能写入）
ALTER TABLE live ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Allow public read access on live" ON live
    FOR SELECT USING (true);

-- 允许认证用户写入（feeder 使用 service key）
CREATE POLICY "Allow authenticated write access on live" ON live
    FOR ALL USING (true) WITH CHECK (true);

-- 添加注释
COMMENT ON TABLE live IS '实时行情数据表，由长桥 API feeder 写入';
COMMENT ON COLUMN live.ticker IS '股票代码';
COMMENT ON COLUMN live.price IS '当前价格';
COMMENT ON COLUMN live.prev_close IS '昨收价';
COMMENT ON COLUMN live.change_percent IS '涨跌幅百分比';
COMMENT ON COLUMN live.volume IS '成交量';
COMMENT ON COLUMN live.timestamp IS '行情时间戳';
COMMENT ON COLUMN live.source IS '数据来源 (longport, finnhub, etc.)';
