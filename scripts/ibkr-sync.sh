#!/bin/bash
# IBKR 数据同步脚本 - 使用 curl 获取数据，然后用 Node 写入数据库

set -e

PROXY="http://127.0.0.1:26561"
IB_TOKEN="325893526716875274131995"
IB_QUERY_ID="1350297"
TEMP_DIR="/tmp/ibkr-sync"

mkdir -p "$TEMP_DIR"

echo "📡 正在请求 IBKR Flex Query..."

# Step 1: 获取 ReferenceCode
RESPONSE=$(curl -x "$PROXY" -s "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest?t=${IB_TOKEN}&q=${IB_QUERY_ID}&v=3")
REF_CODE=$(echo "$RESPONSE" | sed -n 's/.*<ReferenceCode>\([0-9]*\)<\/ReferenceCode>.*/\1/p')

if [ -z "$REF_CODE" ]; then
  echo "❌ 无法获取 ReferenceCode"
  echo "$RESPONSE"
  exit 1
fi

echo "   ReferenceCode: $REF_CODE"
echo "⏳ 等待报表生成..."

# Step 2: 轮询获取报表
for i in {1..20}; do
  sleep 3
  echo "   尝试 $i/20..."
  REPORT=$(curl -x "$PROXY" -s "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement?t=${IB_TOKEN}&q=${REF_CODE}&v=3")
  
  if echo "$REPORT" | grep -q "FlexStatements\|EquitySummaryByReportDateInBase"; then
    echo "   报表已生成!"
    echo "$REPORT" > "$TEMP_DIR/report.xml"
    break
  fi
  
  if [ $i -eq 20 ]; then
    echo "❌ 报表生成超时"
    exit 1
  fi
done

REPORT_SIZE=$(wc -c < "$TEMP_DIR/report.xml")
echo ""
echo "📄 报表大小: $((REPORT_SIZE / 1024)) KB"
echo ""

# Step 3: 使用 Node 脚本解析并写入数据库
npx tsx "$(dirname "$0")/parse-and-insert.ts" "$TEMP_DIR/report.xml"
