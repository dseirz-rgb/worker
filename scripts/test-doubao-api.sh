#!/bin/bash
# 测试豆包 API 连接

echo "测试豆包 (Doubao) API 连接..."
echo ""

curl -s https://ark.cn-beijing.volces.com/api/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 890c5406-4896-4e1f-b8e7-c69491434096" \
  -d '{
    "model": "doubao-seed-1-6-251015",
    "max_completion_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "你好，请用一句话介绍你自己"
      }
    ]
  }' | jq .

echo ""
echo "测试完成！"
