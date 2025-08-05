package main

import (
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"math/big"
	mathRand "math/rand/v2"
	"os"

	blsGnark "github.com/consensys/gnark-crypto/ecc/bls12-381"
	"github.com/consensys/gnark-crypto/ecc/bls12-381/fp"
	blsSon "github.com/supranational/blst/bindings/go"
)

func main() {
	var message string
	var m, n int

	flag.StringVar(&message, "message", "", "要签名的消息内容 (必需)")
	flag.IntVar(&m, "m", 0, "生成的私钥总数 (必需)")
	flag.IntVar(&n, "n", 0, "随机选择用于聚合的私钥数量 (必需, n <= m)")
	flag.Parse()

	// 验证参数
	if message == "" {
		fmt.Fprintf(os.Stderr, "错误: 必须提供消息内容\n")
		flag.Usage()
		os.Exit(1)
	}
	if m <= 0 {
		fmt.Fprintf(os.Stderr, "错误: m 必须大于 0\n")
		flag.Usage()
		os.Exit(1)
	}
	if n <= 0 || n > m {
		fmt.Fprintf(os.Stderr, "错误: n 必须大于 0 且不能大于 m\n")
		flag.Usage()
		os.Exit(1)
	}

	fmt.Printf("开始BLS签名聚合过程...\n")
	fmt.Printf("消息: %s\n", message)
	fmt.Printf("生成私钥数量: %d\n", m)
	fmt.Printf("聚合签名数量: %d\n", n)

	// 生成 m 个私钥和对应的公钥
	privateKeys := make([][]byte, m)
	publicKeys := make([]*blsSon.P1Affine, m)
	
	g1 := blsSon.P1Generator()
	
	for i := 0; i < m; i++ {
		// 生成32字节的随机私钥
		privKey := make([]byte, 32)
		if _, err := rand.Read(privKey); err != nil {
			log.Fatalf("生成私钥失败: %v", err)
		}
		
		// 确保私钥在有效范围内
		privKeyBig := new(big.Int).SetBytes(privKey)
		modulus, _ := new(big.Int).SetString("52435875175126190479447740508185965837690552500527637822603658699938581184513", 10) // BLS12-381 scalar field
		privKeyBig.Mod(privKeyBig, modulus)
		
		// 转换回32字节
		privKeyBytes := make([]byte, 32)
		privKeyBig.FillBytes(privKeyBytes)
		
		privateKeys[i] = privKeyBytes
		
		// 计算对应的公钥
		pubKey := g1.Mult(privKeyBytes)
		publicKeys[i] = pubKey.ToAffine()
		
		fmt.Printf("私钥 %d: %s\n", i+1, hex.EncodeToString(privKeyBytes))
	}

	// 对消息进行哈希映射到 G2
	msgBytes := []byte(message)
	msgG2 := blsSon.HashToG2(msgBytes, nil)

	// 生成 m 个签名
	signatures := make([]*blsSon.P2Affine, m)
	for i := 0; i < m; i++ {
		sig := msgG2.Mult(privateKeys[i])
		signatures[i] = sig.ToAffine()
	}

	// 随机选择 n 个私钥进行聚合
	selectedIndices := mathRand.Perm(m)[:n]
	fmt.Printf("随机选择的索引: %v\n", selectedIndices)

	// 聚合选中的公钥和签名
	aggregatedPubKey := blsSon.P1{}
	aggregatedSignature := blsSon.P2{}

	for _, idx := range selectedIndices {
		aggregatedPubKey.Add(publicKeys[idx])
		aggregatedSignature.Add(signatures[idx])
	}

	fmt.Printf("聚合完成\n")

	// 生成用于预编译合约 0xf 的 calldata
	calldata, err := generatePairingCalldata(
		aggregatedPubKey.ToAffine(),
		aggregatedSignature.ToAffine(),
		msgG2.ToAffine(),
	)
	if err != nil {
		log.Fatalf("生成calldata失败: %v", err)
	}

	// 输出结果
	fmt.Printf("\n=== 结果 ===\n")
	fmt.Printf("预编译合约 0xf 的 calldata:\n")
	fmt.Printf("0x%s\n", hex.EncodeToString(calldata))
	fmt.Printf("\ncalldata 长度: %d 字节\n", len(calldata))
	fmt.Printf("配对数量: %d\n", len(calldata)/384)
}

// generatePairingCalldata 生成 BLS 签名验证的配对数据
// 验证公式: e(G1, aggregatedSignature) = e(aggregatedPubKey, msgG2)
// 转换为配对检查: e(G1, aggregatedSignature) * e(-aggregatedPubKey, msgG2) = 1
func generatePairingCalldata(aggregatedPubKey *blsSon.P1Affine, aggregatedSignature *blsSon.P2Affine, msgG2 *blsSon.P2Affine) ([]byte, error) {
	g1 := blsSon.P1Generator()
	
	// 转换聚合公钥为 gnark 格式进行取负
	pubKeyGnark := convertSonToG1Gnark(aggregatedPubKey)
	negPubKey := new(blsGnark.G1Affine)
	negPubKey.Neg(pubKeyGnark)
	negPubKeySon := convertG1ToBlsSon(negPubKey)

	// 生成配对输入: (G1, aggregatedSignature) 和 (-aggregatedPubKey, msgG2)
	input, err := getInputForPrecompiledContract(
		[]blsSon.P1Affine{*g1.ToAffine(), *negPubKeySon},
		[]blsSon.P2Affine{*aggregatedSignature, *msgG2},
	)
	if err != nil {
		return nil, fmt.Errorf("生成配对输入失败: %w", err)
	}

	return input, nil
}

// === 辅助函数 (从 signer-node 复制) ===

// convertG1ToBlsSon 将gnark G1点转换为supranational格式
func convertG1ToBlsSon(p *blsGnark.G1Affine) *blsSon.P1Affine {
	compressed := p.Bytes()
	var result blsSon.P1Affine
	result.Uncompress(compressed[:])
	return &result
}

// convertSonToG1Gnark 将supranational G1点转换为gnark格式
func convertSonToG1Gnark(p *blsSon.P1Affine) *blsGnark.G1Affine {
	compressed := p.Compress()
	var result blsGnark.G1Affine
	result.SetBytes(compressed[:])
	return &result
}

// getInputPQ 将单个点对编码为字节数组
func getInputPQ(p *blsSon.P1Affine, q *blsSon.P2Affine) []byte {
	keyPoint := new(blsGnark.G1Affine)
	keyPoint.SetBytes(p.Compress())
	keyBytes := encodePointG1(keyPoint)

	sigPoint := new(blsGnark.G2Affine)
	sigPoint.SetBytes(q.Compress())
	sigBytes := encodePointG2(sigPoint)
	return append(keyBytes, sigBytes...)
}

// getInputForPrecompiledContract 为预编译合约生成输入数据
func getInputForPrecompiledContract(p []blsSon.P1Affine, q []blsSon.P2Affine) ([]byte, error) {
	if len(p) == 0 || len(p) != len(q) {
		return nil, fmt.Errorf("无效的输入长度: p=%d, q=%d", len(p), len(q))
	}

	input := make([]byte, 0, len(p)*384) // 预分配空间
	for i := 0; i < len(p); i++ {
		input = append(input, getInputPQ(&p[i], &q[i])...)
	}
	return input, nil
}

// encodePointG1 按EIP-2537格式编码G1点
func encodePointG1(p *blsGnark.G1Affine) []byte {
	out := make([]byte, 128)
	fp.BigEndian.PutElement((*[fp.Bytes]byte)(out[16:]), p.X)
	fp.BigEndian.PutElement((*[fp.Bytes]byte)(out[64+16:]), p.Y)
	return out
}

// encodePointG2 按EIP-2537格式编码G2点
func encodePointG2(p *blsGnark.G2Affine) []byte {
	out := make([]byte, 256)
	fp.BigEndian.PutElement((*[fp.Bytes]byte)(out[16:16+48]), p.X.A0)
	fp.BigEndian.PutElement((*[fp.Bytes]byte)(out[80:80+48]), p.X.A1)
	fp.BigEndian.PutElement((*[fp.Bytes]byte)(out[144:144+48]), p.Y.A0)
	fp.BigEndian.PutElement((*[fp.Bytes]byte)(out[208:208+48]), p.Y.A1)
	return out
}