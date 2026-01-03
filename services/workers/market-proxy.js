// Cloudflare Worker: Market Data Proxy
// 部署说明：
// 1. 登录 Cloudflare Dashboard -> Workers & Pages -> Create Application
// 2. 创建一个名为 "riskcontrol-market-proxy" 的 Worker
// 3. 将此代码复制粘贴到编辑器中
// 4. 保存并部署
// 5. (可选) 在 Settings -> Variables 中添加 POLYGON_API_KEY 环境变量

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理 CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 只处理 /quote 路径
    if (url.pathname === "/quote") {
      const symbol = url.searchParams.get("symbol");
      if (!symbol) {
        return new Response("Missing symbol", { status: 400 });
      }

      // 获取历史数据参数
      const history = url.searchParams.get("history") === "true";
      const range = url.searchParams.get("range") || "1mo";
      const interval = url.searchParams.get("interval") || "1d";

      try {
        // 1. 优先尝试 Yahoo Finance (v8 chart API)
        // Yahoo Finance 数据最全，包含盘前盘后
        // 如果请求历史数据，透传 range 和 interval 参数
        const yahooRange = history ? range : "1d";
        const yahooInterval = history ? interval : "1d";
        
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${yahooInterval}&range=${yahooRange}`;
        
        const yahooResp = await fetch(yahooUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (yahooResp.ok) {
          const data = await yahooResp.json();
          
          // 如果请求历史数据，直接返回 Yahoo 原始数据结构
          if (history) {
             return new Response(JSON.stringify(data), {
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
              }
            });
          }

          // 否则（实时数据），提取最新价格
          const result = data.chart?.result?.[0];
          
          if (result) {
            const meta = result.meta;
            // 智能价格选择：优先盘前/盘后
            let price = meta.regularMarketPrice;
            
            // 简单的时段判断（如果有 postMarketPrice 且不为0，说明可能是盘后）
            if (meta.postMarketPrice && meta.postMarketPrice > 0) {
                price = meta.postMarketPrice;
            } else if (meta.preMarketPrice && meta.preMarketPrice > 0) {
                // 如果是盘前（需要更复杂的判断，这里简单处理）
                price = meta.preMarketPrice;
            }

            return new Response(JSON.stringify({
              source: "yahoo",
              symbol: meta.symbol,
              price: price,
              prevClose: meta.previousClose || price,
              currency: meta.currency,
              timestamp: Date.now()
            }), {
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
              }
            });
          }
        }

        // 2. 备用：Polygon (如果配置了 API Key) - 仅用于实时数据
        // 从环境变量获取 API Key，或者硬编码（不推荐）
        if (!history) {
            const polygonKey = env.POLYGON_API_KEY || 'X50Z9vTkZFKBGM0cVRL0thD90BNVglhp'; // 你的 Key
            if (polygonKey) {
                // 尝试 Last Trade
                const polyUrl = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${polygonKey}`;
                const polyResp = await fetch(polyUrl);
                
                if (polyResp.ok) {
                    const data = await polyResp.json();
                    if (data.results) {
                        return new Response(JSON.stringify({
                            source: "polygon",
                            symbol: data.results.T,
                            price: data.results.p,
                            prevClose: data.results.p, // 暂无昨收
                            currency: "USD",
                            timestamp: data.results.t
                        }), {
                            headers: { 
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*" 
                            }
                        });
                    }
                }
            }
        }

        return new Response(JSON.stringify({ error: "No data found" }), {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
