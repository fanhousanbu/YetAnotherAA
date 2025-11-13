# EIP-7702 Reference Implementations

This directory contains reference implementations and demos from various projects implementing EIP-7702 (Set EOA Account Code).

## 📚 Included Projects

### 1. MetaMask 7702 Livestream Demo
**Path**: `metamask-7702-livestream-demo/`
**Repository**: https://github.com/MetaMask/7702-livestream-demo
**Description**: Official MetaMask demonstration of EIP-7702 implementation

### 2. Amie Corso - EIP-7702 Viem Demo
**Path**: `amiecorso-eip7702-viem-demo/`
**Repository**: https://github.com/amiecorso/eip7702-viem-demo
**Description**: EIP-7702 implementation using Viem library

### 3. Pimlico - 7702 UserOp Demo
**Path**: `pimlico-7702-userop-demo/`
**Repository**: https://github.com/pimlicolabs/7702-userop-demo
**Description**: Integration of EIP-7702 with UserOperations for account abstraction

### 4. Gelato - EIP-7702 Demo
**Path**: `gelato-eip-7702-demo/`
**Repository**: https://github.com/gelatodigital/gelato-eip-7702-demo
**Description**: Gelato's implementation of EIP-7702 with automation features

### 5. Pimlico - 7702 Demo
**Path**: `pimlico-7702-demo/`
**Repository**: https://github.com/pimlicolabs/7702-demo
**Description**: Pimlico's comprehensive EIP-7702 demonstration

### 6. Martin - EIP-7702 Viem Demo
**Path**: `mart1n-eip7702-viem-demo/`
**Repository**: https://github.com/mart1n-xyz/eip7702-viem-demo
**Description**: Another Viem-based EIP-7702 implementation

### 7. Cqlyj - Simple EIP-7702
**Path**: `cqlyj-simple-eip-7702/`
**Repository**: https://github.com/cqlyj/simple-eip-7702
**Description**: Simplified EIP-7702 implementation for learning purposes

### 8. Myron Zhang - ERC-7702 Demo
**Path**: `myronzhang-erc7702-demo/`
**Repository**: https://github.com/myronzhangweb3/erc7702-demo
**Description**: Educational EIP-7702 demonstration

### 9. Jooohneth - 7702 Demo
**Path**: `jooohneth-7702-demo/`
**Repository**: https://github.com/jooohneth/7702-demo
**Description**: Community-contributed EIP-7702 implementation

## 📖 Additional Resources

### Documentation
- **EIP-7702 Specification**: https://eips.ethereum.org/EIPS/eip-7702
- **Pimlico Guides**: https://docs.pimlico.io/guides/eip7702
- **Pimlico Demo Guide**: https://docs.pimlico.io/guides/eip7702/demo

## 🔄 Updating Submodules

To update all vendor submodules to their latest versions:

```bash
# Update all submodules
git submodule update --remote --merge

# Or update a specific submodule
git submodule update --remote --merge 7702/vendor/metamask-7702-livestream-demo
```

## 📥 Initializing Submodules

If you cloned this repository without submodules:

```bash
# Initialize and clone all submodules
git submodule update --init --recursive

# Or for a specific submodule
git submodule update --init 7702/vendor/metamask-7702-livestream-demo
```

## 🎯 Purpose

These reference implementations serve multiple purposes:

1. **Learning**: Study different approaches to implementing EIP-7702
2. **Comparison**: Compare implementations across different libraries and frameworks
3. **Integration**: Understand how to integrate EIP-7702 with existing tools
4. **Best Practices**: Learn from production-ready implementations

## 🔍 Exploration Guide

### For Beginners
Start with:
1. `cqlyj-simple-eip-7702/` - Simplified implementation
2. `metamask-7702-livestream-demo/` - Official MetaMask demo
3. Review the EIP-7702 specification

### For Integration
Focus on:
1. `pimlico-7702-userop-demo/` - UserOp integration
2. `gelato-eip-7702-demo/` - Automation features
3. `amiecorso-eip7702-viem-demo/` - Viem library usage

### For Advanced Use Cases
Explore:
1. All demos to see different architectural patterns
2. Compare gas optimization techniques
3. Study security considerations

## ⚠️ Important Notes

- These are **reference implementations** for learning and research
- Always audit code before using in production
- Check each repository's license before using code
- Submodules may have different dependencies and setup requirements
- Some demos may require specific network configurations

## 🤝 Contributing

To add a new reference implementation:

```bash
git submodule add <repository-url> 7702/vendor/<project-name>
```

Then update this README with the project details.

## 📄 License

Each submodule has its own license. Please refer to individual repositories for licensing information.

---

**Maintained by**: YetAnotherAA Team
**Last Updated**: 2025-11-13
