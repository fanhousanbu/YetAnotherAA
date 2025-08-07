package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strings"
)

// ContractParams 合约调用参数结构
type ContractParams struct {
	PublicKeys          []string `json:"publicKeys"`
	AggregatedSignature string   `json:"aggregatedSignature"`
	MessageG2           string   `json:"messageG2"`
}

const (
	CONTRACT_ADDRESS = "0xBceAb05F67d23CBeF4118E86f56c1C2aC029B25c"
	RPC_URL          = "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20"
	PRIVATE_KEY      = "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("用法: go run contract-caller.go <signer-json-output>")
		fmt.Println("或者: ./signer | go run contract-caller.go")
		os.Exit(1)
	}

	var input string
	if os.Args[1] == "-" {
		// 从stdin读取
		inputBytes, err := io.ReadAll(os.Stdin)
		if err != nil {
			log.Fatalf("读取stdin失败: %v", err)
		}
		input = string(inputBytes)
	} else {
		// 从参数读取
		input = os.Args[1]
	}

	// 解析JSON参数
	var params ContractParams
	if err := json.Unmarshal([]byte(input), &params); err != nil {
		log.Fatalf("解析JSON失败: %v", err)
	}

	fmt.Printf("=== 合约验证调用 ===\n")
	fmt.Printf("合约地址: %s\n", CONTRACT_ADDRESS)
	fmt.Printf("公钥数量: %d\n", len(params.PublicKeys))
	fmt.Printf("\n")

	// 1. 测试gas估算
	fmt.Printf("1. 获取gas估算...\n")
	gasCost, err := getGasEstimation(len(params.PublicKeys))
	if err != nil {
		log.Printf("gas估算失败: %v", err)
	} else {
		fmt.Printf("预估gas消耗: %s\n", gasCost)
	}
	fmt.Printf("\n")

	// 2. 调用验证函数
	fmt.Printf("2. 调用BLS签名验证...\n")
	result, err := callVerifyFunction(params)
	if err != nil {
		log.Fatalf("合约调用失败: %v", err)
	}

	fmt.Printf("🎯 验证结果: %s\n", formatResult(result))
	
	if strings.Contains(result, "0x0000000000000000000000000000000000000000000000000000000000000001") {
		fmt.Printf("🎉 签名验证成功！BLS聚合签名验证通过！\n")
	} else if strings.Contains(result, "0x0000000000000000000000000000000000000000000000000000000000000000") {
		fmt.Printf("❌ 签名验证失败，需要进一步调试数据格式\n")
	} else {
		fmt.Printf("⚠️  未知的验证结果: %s\n", result)
	}
}

// getGasEstimation 获取gas消耗估算
func getGasEstimation(pubKeyCount int) (string, error) {
	cmd := exec.Command("cast", "call",
		"--rpc-url", RPC_URL,
		CONTRACT_ADDRESS,
		"getVerificationGasCost(uint256)(uint256)",
		fmt.Sprintf("%d", pubKeyCount))

	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("cast调用失败: %v", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// callVerifyFunction 调用验证函数
func callVerifyFunction(params ContractParams) (string, error) {
	// 构建公钥数组参数
	var pubKeyArgs []string
	for _, pk := range params.PublicKeys {
		pubKeyArgs = append(pubKeyArgs, pk)
	}
	pubKeysStr := "[" + strings.Join(pubKeyArgs, ",") + "]"

	// 构建cast命令
	cmd := exec.Command("cast", "call",
		"--rpc-url", RPC_URL,
		CONTRACT_ADDRESS,
		"verifyAggregatedSignature(bytes[],bytes,bytes)(bool)",
		pubKeysStr,
		params.AggregatedSignature,
		params.MessageG2)

	output, err := cmd.Output()
	if err != nil {
		// 如果cast调用失败，尝试使用curl调用
		return callWithCurl(params)
	}

	return strings.TrimSpace(string(output)), nil
}

// callWithCurl 使用curl调用合约（备选方案）
func callWithCurl(params ContractParams) (string, error) {
	fmt.Printf("cast调用失败，尝试使用forge script...\n")
	
	// 生成临时的forge script
	scriptContent := generateForgeScript(params)
	
	// 写入临时文件
	tmpFile := "/tmp/TestVerify.s.sol"
	if err := os.WriteFile(tmpFile, []byte(scriptContent), 0644); err != nil {
		return "", fmt.Errorf("写入临时脚本失败: %v", err)
	}
	
	// 运行forge script
	cmd := exec.Command("forge", "script", tmpFile,
		"--rpc-url", RPC_URL,
		"-vv")
	
	cmd.Dir = "/Users/chao/Codes/YetAnotherAA/validator"
	
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("forge script失败: %v, output: %s", err, output)
	}
	
	return string(output), nil
}

// generateForgeScript 生成forge测试脚本
func generateForgeScript(params ContractParams) string {
	script := `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ValidatorBLS.sol";

contract TestVerifyScript is Script {
    ValidatorBLS validator = ValidatorBLS(` + CONTRACT_ADDRESS + `);
    
    function run() external view {
        bytes[] memory publicKeys = new bytes[](` + fmt.Sprintf("%d", len(params.PublicKeys)) + `);
`
	
	// 添加公钥数据
	for i, pk := range params.PublicKeys {
		script += fmt.Sprintf("        publicKeys[%d] = hex\"%s\";\n", i, strings.TrimPrefix(pk, "0x"))
	}
	
	script += `        
        bytes memory aggregatedSignature = hex"` + strings.TrimPrefix(params.AggregatedSignature, "0x") + `";
        bytes memory messageG2 = hex"` + strings.TrimPrefix(params.MessageG2, "0x") + `";
        
        console.log("调用验证函数...");
        bool result = validator.verifyAggregatedSignature(publicKeys, aggregatedSignature, messageG2);
        console.log("验证结果:", result);
        
        if (result) {
            console.log("SUCCESS: BLS signature verification passed!");
        } else {
            console.log("FAILED: BLS signature verification failed!");
        }
    }
}`

	return script
}

// formatResult 格式化结果输出
func formatResult(result string) string {
	result = strings.TrimSpace(result)
	if result == "true" {
		return "✅ 验证通过"
	} else if result == "false" {
		return "❌ 验证失败"
	} else if strings.Contains(result, "0x0000000000000000000000000000000000000000000000000000000000000001") {
		return "✅ 验证通过 (返回值: 1)"
	} else if strings.Contains(result, "0x0000000000000000000000000000000000000000000000000000000000000000") {
		return "❌ 验证失败 (返回值: 0)"
	}
	return result
}