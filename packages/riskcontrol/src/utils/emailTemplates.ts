
/**
 * RiskControl Email Templates
 * Design System: "Cyberpunk/Financial Terminal"
 * Colors: Dark Slate (#0f172a), Cyan (#06b6d4), Red (#ef4444), Green (#10b981)
 */

interface MarketResearchData {
    date: string;
    analysisTitle: string;
    analysisSummary: string;
    analysisContent: string; // HTML or Markdown converted to HTML
    riskLevel: string;
    recommendation: string;
    actionPlan?: string; // 可选的行动计划
}

interface EmergencyAlertData {
    title: string;
    message: string;
    date: string;
    netWorth: number;
    drawdown: number;
    cashRatio: number;
}

interface DailyRiskReportData {
    date: string;
    netWorth: number;
    dailyPnL: number;
    dailyPnLPercent: number;
    riskLevel: string; // LOW, MEDIUM, HIGH, CRITICAL
    cashRatio: number;
    topPositions?: Array<{ ticker: string, weight: number, pnl: number }>;
}

export const styles = {
    // ... (keep existing styles)
    body: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;',
    container: 'max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);',
    header: 'background-color: #0f172a; padding: 24px; border-bottom: 1px solid #334155; text-align: center;',
    logo: 'color: #06b6d4; font-size: 20px; font-weight: 800; letter-spacing: 1px; margin: 0;',
    content: 'padding: 24px;',
    sectionTitle: 'color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 12px; margin-top: 24px;',
    card: 'background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px;',
    valueBig: 'font-size: 32px; font-weight: 700; color: #f8fafc; letter-spacing: -1px;',
    valueLabel: 'font-size: 14px; color: #94a3b8;',
    badge: 'display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;',
    badgeGreen: 'background-color: rgba(16, 185, 129, 0.1); color: #34d399;',
    badgeRed: 'background-color: rgba(239, 68, 68, 0.1); color: #f87171;',
    badgeYellow: 'background-color: rgba(245, 158, 11, 0.1); color: #fbbf24;',
    badgeCyan: 'background-color: rgba(6, 182, 212, 0.1); color: #22d3ee;',
    footer: 'text-align: center; padding: 24px; color: #64748b; font-size: 12px; border-top: 1px solid #334155; background-color: #0f172a;',
    markdown: 'line-height: 1.6; font-size: 15px; color: #cbd5e1;',
    divider: 'border: 0; border-top: 1px solid #334155; margin: 24px 0;',
    strong: 'color: #22d3ee; font-weight: 700;', 
    em: 'color: #fbbf24; font-style: italic;',   
    buttonContainer: 'text-align: center; margin-top: 32px; margin-bottom: 24px;',
    button: 'background-color: #06b6d4; color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 800; font-size: 14px; letter-spacing: 1px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(6, 182, 212, 0.3);'
};

const DASHBOARD_URL = 'https://provip.vercel.app/dashboard';

// 1. Daily Risk Report (Focus on PnL & Metrics)
export function getDailyRiskReportHtml(data: DailyRiskReportData): string {
    const isPnLPositive = data.dailyPnL >= 0;
    const pnlColor = isPnLPositive ? '#34d399' : '#f87171';
    const pnlSign = isPnLPositive ? '+' : '';
    
    // Risk Level Badge Logic
    let riskBadgeStyle = styles.badgeYellow;
    if (data.riskLevel === 'HIGH' || data.riskLevel === 'CRITICAL') riskBadgeStyle = styles.badgeRed;
    if (data.riskLevel === 'LOW') riskBadgeStyle = styles.badgeGreen;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RiskControl Daily</title>
    </head>
    <body style="${styles.body}">
        <div style="${styles.container}">
            <!-- Header -->
            <div style="${styles.header}">
                <h1 style="${styles.logo}">RISKCONTROL <span style="color: #64748b; font-weight: 400;">| DAILY</span></h1>
                <p style="color: #64748b; font-size: 12px; margin-top: 8px;">${data.date}</p>
            </div>

            <div style="${styles.content}">
                
                <!-- Hero Metrics -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div style="${styles.card}">
                        <div style="${styles.valueLabel}">Net Worth (CNY)</div>
                        <div style="${styles.valueBig}">¥${data.netWorth.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style="${styles.card}">
                        <div style="${styles.valueLabel}">Daily PnL</div>
                        <div style="${styles.valueBig} color: ${pnlColor};">
                            ${pnlSign}${data.dailyPnL.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                            <span style="font-size: 14px; opacity: 0.8;">(${pnlSign}${data.dailyPnLPercent.toFixed(2)}%)</span>
                        </div>
                    </div>
                </div>
                
                 <!-- Key Ratios -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                     <div style="${styles.card} display: flex; justify-content: space-between; align-items: center;">
                        <span style="${styles.valueLabel}">Risk Level</span>
                        <span style="${styles.badge} ${riskBadgeStyle}">${data.riskLevel}</span>
                    </div>
                    <div style="${styles.card} display: flex; justify-content: space-between; align-items: center;">
                        <span style="${styles.valueLabel}">Cash Ratio</span>
                        <span style="color: #f8fafc; font-weight: 600;">${(data.cashRatio).toFixed(1)}%</span>
                    </div>
                </div>

                <!-- Top Positions (Optional) -->
                ${data.topPositions && data.topPositions.length > 0 ? `
                    <div style="${styles.sectionTitle}">TOP POSITIONS</div>
                    <div style="${styles.card}">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="text-align: left; color: #94a3b8;">
                                    <th style="padding-bottom: 8px;">Ticker</th>
                                    <th style="padding-bottom: 8px; text-align: right;">Weight</th>
                                    <th style="padding-bottom: 8px; text-align: right;">PnL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.topPositions.map(pos => `
                                    <tr style="border-top: 1px solid #334155;">
                                        <td style="padding: 12px 0; color: #f8fafc; font-weight: 600;">${pos.ticker}</td>
                                        <td style="padding: 12px 0; text-align: right; color: #cbd5e1;">${(pos.weight * 100).toFixed(1)}%</td>
                                        <td style="padding: 12px 0; text-align: right; color: ${pos.pnl >= 0 ? '#34d399' : '#f87171'};">${pos.pnl > 0 ? '+' : ''}${(pos.pnl * 100).toFixed(2)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
                
                <!-- CTA Button -->
                <div style="${styles.buttonContainer}">
                    <a href="${DASHBOARD_URL}" style="${styles.button}">
                        OPEN DASHBOARD
                    </a>
                </div>

            </div>

            <!-- Footer -->
            <div style="${styles.footer}">
                <p>Generated by RiskControl AI</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// 2. Market Research (Focus on AI Analysis)
export function getMarketResearchHtml(data: MarketResearchData): string {
    // Risk Level Badge Logic
    let riskBadgeStyle = styles.badgeYellow;
    if (data.riskLevel === 'HIGH' || data.riskLevel === 'CRITICAL') riskBadgeStyle = styles.badgeRed;
    if (data.riskLevel === 'LOW') riskBadgeStyle = styles.badgeGreen;

    // Recommendation Color
    let recColor = '#fbbf24';
    if (data.recommendation === 'BUY') recColor = '#34d399';
    if (data.recommendation === 'SELL') recColor = '#f87171';
    
    let processedContent = data.analysisContent
        .replace(/<strong>/g, `<strong style="${styles.strong}">`)
        .replace(/<em>/g, `<em style="${styles.em}">`)
        .replace(/<h3>/g, `<h3 style="color: #f8fafc; font-size: 16px; margin-top: 20px; border-bottom: 1px solid #334155; padding-bottom: 8px;">`)
        .replace(/<ul>/g, `<ul style="padding-left: 20px; margin: 12px 0;">`)
        .replace(/<li>/g, `<li style="margin-bottom: 8px;">`);

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RiskControl Research</title>
    </head>
    <body style="${styles.body}">
        <div style="${styles.container}">
            <!-- Header -->
            <div style="${styles.header}">
                <h1 style="${styles.logo}">RISKCONTROL <span style="color: #64748b; font-weight: 400;">| RESEARCH</span></h1>
                <p style="color: #64748b; font-size: 12px; margin-top: 8px;">${data.date}</p>
            </div>

            <div style="${styles.content}">
                
                <!-- AI Analysis -->
                <div style="${styles.sectionTitle}">AI INTELLIGENCE REPORT</div>
                <div style="${styles.card} border-left: 4px solid #06b6d4;">
                    <div style="display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 16px; gap: 12px;">
                        <div style="display: flex; flex-direction: column; justify-content: center; min-width: 80px;">
                            <span style="${styles.badge} ${riskBadgeStyle} margin-bottom: 8px; text-align: center;">RISK: ${data.riskLevel}</span>
                            <span style="${styles.badge} border: 1px solid ${recColor}; color: ${recColor}; background: transparent; text-align: center;">${data.recommendation}</span>
                        </div>
                        ${data.actionPlan ? `
                        <div style="flex: 1; border: 1px solid #fbbf24; background-color: rgba(251, 191, 36, 0.05); padding: 12px; border-radius: 6px; display: flex; align-items: center;">
                            <p style="margin: 0; color: #fbbf24; font-size: 13px; font-weight: 600; line-height: 1.4;">
                                <span style="text-transform: uppercase; opacity: 0.7; font-size: 11px; display: block; margin-bottom: 4px;">Action Plan</span>
                                ${data.actionPlan}
                            </p>
                        </div>
                        ` : ''}
                    </div>
                    
                    <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 12px 0;">${data.analysisTitle}</h2>
                    
                    <div style="background-color: rgba(6, 182, 212, 0.05); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                        <p style="margin: 0; color: #cbd5e1; font-style: italic; font-size: 14px;">"${data.analysisSummary}"</p>
                    </div>

                    <div style="${styles.markdown}">
                        ${processedContent}
                    </div>
                </div>
                
                 <!-- CTA Button -->
                <div style="${styles.buttonContainer}">
                    <a href="${DASHBOARD_URL}" style="${styles.button}">
                        OPEN DASHBOARD
                    </a>
                </div>

            </div>

            <!-- Footer -->
            <div style="${styles.footer}">
                <p>Generated by RiskControl AI • Gemini 3.0 Pro</p>
                <p style="opacity: 0.5; margin-top: 8px;">Investment involves risk. This is an automated report.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// 3. Emergency Alert
export function getEmergencyAlertHtml(data: EmergencyAlertData): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EMERGENCY ALERT</title>
    </head>
    <body style="${styles.body} background-color: #2a0a0a;">
        <div style="${styles.container} border: 2px solid #ef4444;">
            <div style="${styles.header} background-color: #450a0a; border-bottom: 1px solid #ef4444;">
                <h1 style="color: #ef4444; margin: 0; font-size: 24px;">🚨 RISK ALERT</h1>
            </div>

            <div style="${styles.content}">
                <div style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                    <h2 style="color: #f87171; margin-top: 0; font-size: 18px;">${data.title}</h2>
                    <p style="color: #fca5a5; margin-bottom: 0;">${data.message}</p>
                </div>

                <div style="${styles.sectionTitle}">ACCOUNT SNAPSHOT</div>
                <div style="${styles.card}">
                    <table style="width: 100%; color: #cbd5e1; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0;">Time</td>
                            <td style="text-align: right; font-weight: bold;">${data.date}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Net Worth</td>
                            <td style="text-align: right; font-weight: bold;">¥${data.netWorth.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Drawdown</td>
                            <td style="text-align: right; font-weight: bold; color: #ef4444;">${data.drawdown.toFixed(2)}%</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Cash Ratio</td>
                            <td style="text-align: right; font-weight: bold;">${data.cashRatio.toFixed(2)}%</td>
                        </tr>
                    </table>
                </div>

                <div style="${styles.buttonContainer}">
                    <a href="${DASHBOARD_URL}" style="${styles.button} background-color: #ef4444; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3);">OPEN DASHBOARD</a>
                </div>
            </div>
            
             <div style="${styles.footer} background-color: #2a0a0a;">
                <p style="color: #ef4444;">This is an automated emergency notification.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}
