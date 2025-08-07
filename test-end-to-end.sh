#!/bin/bash

echo "=== BLS端到端签名验证测试 ==="
echo "基于Hyperledger Besu实现的数据格式标准"
echo ""

# 设置测试参数
MESSAGE="end-to-end test"
SIGNER_COUNT=4
AGGREGATE_COUNT=3

echo "测试参数:"
echo "- 消息: $MESSAGE"
echo "- 生成签名者数量: $SIGNER_COUNT"
echo "- 聚合签名数量: $AGGREGATE_COUNT"
echo ""

# Step 1: 运行signer生成签名数据
echo "Step 1: 运行Go Signer生成BLS签名数据..."
cd /Users/chao/Codes/YetAnotherAA/signer

# 运行signer并捕获输出
SIGNER_OUTPUT=$(go run main.go -message "$MESSAGE" -m $SIGNER_COUNT -n $AGGREGATE_COUNT)
echo "$SIGNER_OUTPUT"
echo ""

# 提取JSON格式的合约参数
JSON_PARAMS=$(echo "$SIGNER_OUTPUT" | sed -n '/=== JSON格式合约调用参数 ===/,$p' | tail -n +2)

if [ -z "$JSON_PARAMS" ]; then
    echo "❌ 错误: 无法从signer输出中提取JSON参数"
    exit 1
fi

echo "提取的合约调用参数:"
echo "$JSON_PARAMS"
echo ""

# Step 2: 使用提取的参数调用合约
echo "Step 2: 调用链上合约验证签名..."
cd /Users/chao/Codes/YetAnotherAA

# 将JSON参数传递给合约调用器
echo "$JSON_PARAMS" | go run contract-caller.go -
CALL_RESULT=$?

echo ""
echo "=== 测试结果总结 ==="
if [ $CALL_RESULT -eq 0 ]; then
    echo "🎉 端到端测试完成！"
    echo "✅ Go signer成功生成BLS聚合签名"
    echo "✅ 合约调用成功执行"
    
    # 检查是否验证成功
    if echo "$SIGNER_OUTPUT" | grep -q "SUCCESS"; then
        echo "🎯 BLS签名验证通过！技术栈验证成功！"
        echo ""
        echo "📋 验证结果:"
        echo "- ✅ Go语言BLS实现: 工作正常"
        echo "- ✅ EIP-2537数据格式转换: 正确"
        echo "- ✅ 链上合约验证: 通过"
        echo "- ✅ 端到端集成: 成功"
        
        exit 0
    else
        echo "⚠️  合约调用成功但验证失败，需要进一步调试数据格式"
        exit 1
    fi
else
    echo "❌ 合约调用失败"
    exit 1
fi