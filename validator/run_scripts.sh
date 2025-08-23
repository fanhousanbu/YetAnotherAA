#!/bin/bash

# 脚本执行器 - 自动加载环境变量并运行 Foundry 脚本
# 使用方法: ./run_scripts.sh <script_name>
# 例如: ./run_scripts.sh TestBlsSignature.s.sol

# 检查参数
if [ $# -eq 0 ]; then
    echo "使用方法: ./run_test.sh <script_name>"
    echo "可用脚本:"
    ls script/*.s.sol | sed 's|script/||'
    exit 1
fi

SCRIPT_NAME=$1

# 检查脚本文件是否存在
if [ ! -f "script/$SCRIPT_NAME" ]; then
    echo "错误: script/$SCRIPT_NAME 不存在"
    echo "可用脚本:"
    ls script/*.s.sol | sed 's|script/||'
    exit 1
fi

# 加载环境变量
if [ -f "../.env" ]; then
    source ../.env
    echo "✅ 环境变量已加载"
else
    echo "❌ 未找到 ../.env 文件"
    exit 1
fi

# 检查必要的环境变量
if [ -z "$ETH_RPC_URL" ]; then
    echo "❌ ETH_RPC_URL 未设置"
    exit 1
fi

echo "📝 运行脚本: $SCRIPT_NAME"
echo "🌐 RPC URL: $ETH_RPC_URL"
echo "📍 合约地址: ${VALIDATOR_CONTRACT_ADDRESS:-未设置}"
echo ""

# 根据脚本类型选择不同的执行方式
case $SCRIPT_NAME in
    "DeployAAStarValidator.s.sol"|"RegisterKeys.s.sol")
        # 需要私钥的部署脚本
        if [ -z "$ETH_PRIVATE_KEY" ]; then
            echo "❌ 此脚本需要 ETH_PRIVATE_KEY"
            exit 1
        fi
        forge script script/$SCRIPT_NAME --rpc-url $ETH_RPC_URL --private-key $ETH_PRIVATE_KEY --broadcast -vvv
        ;;
    "DeployAndTest.s.sol")
        # 多合约脚本，需要指定合约名称
        if [ -z "$ETH_PRIVATE_KEY" ]; then
            echo "❌ 此脚本需要 ETH_PRIVATE_KEY"
            exit 1
        fi
        forge script script/$SCRIPT_NAME --tc DeployAndTest --rpc-url $ETH_RPC_URL --private-key $ETH_PRIVATE_KEY --broadcast -vvv
        ;;
    "TestAAStarIntegration.s.sol")
        # 集成测试脚本
        if [ -z "$ETH_PRIVATE_KEY" ]; then
            echo "❌ 此脚本需要 ETH_PRIVATE_KEY"
            exit 1
        fi
        forge script script/$SCRIPT_NAME --rpc-url $ETH_RPC_URL --private-key $ETH_PRIVATE_KEY --broadcast -vvv
        ;;
    "TestPrecompiles.s.sol")
        # 需要 fork 的脚本
        forge script script/$SCRIPT_NAME --fork-url $ETH_RPC_URL -vvv
        ;;
    *)
        # 默认的只读脚本
        forge script script/$SCRIPT_NAME --rpc-url $ETH_RPC_URL -vvv
        ;;
esac

echo ""
echo "✅ 脚本执行完成"