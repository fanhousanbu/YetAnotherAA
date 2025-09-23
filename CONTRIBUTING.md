# 🤝 Contributing to YetAnotherAA

We love your input! We want to make contributing to YetAnotherAA as easy and
transparent as possible.

## 🚀 Quick Start for Contributors

1. **Fork the repo** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your feature:
   `git checkout -b feature/amazing-feature`
4. **Make your changes** following our guidelines
5. **Test thoroughly** including WebAuthn/Passkey flows
6. **Submit a pull request**

## 🏗️ Development Setup

```bash
# Fork and clone
git clone https://github.com/your-username/YetAnotherAA.git
cd YetAnotherAA

# Install dependencies
npm install

# Set up development environment
cp aastar/.env.example aastar/.env
cp signer/.env.example signer/.env
cp aastar-frontend/.env.example aastar-frontend/.env.local

# Start development servers
npm run start:dev -w aastar        # Backend API
npm run start:dev -w signer        # BLS Signer
npm run dev -w aastar-frontend     # Frontend
```

## 🔐 Testing WebAuthn/Passkey Features

Since WebAuthn requires HTTPS or localhost, ensure you test:

1. **Browser Compatibility**: Chrome, Safari, Firefox, Edge
2. **Device Support**: Test on actual devices with biometric sensors
3. **Error Handling**: Test cancelled authentications, timeouts
4. **Multi-device**: Test registering on multiple devices

```bash
# Test backend authentication
curl -X POST http://localhost:3000/auth/passkey/login/begin

# Test transaction verification
curl -X POST http://localhost:3000/auth/transaction/verify/begin

# Manual testing checklist
# - [ ] Face ID/Touch ID registration works
# - [ ] Passwordless login works
# - [ ] Transaction verification required
# - [ ] Multi-device registration works
```

## 📝 Commit Guidelines

We follow [Conventional Commits](https://conventionalcommits.org/):

```
type(scope): description

feat(auth): add Face ID support for iOS
fix(bls): resolve signature verification bug
docs(readme): update WebAuthn setup guide
test(passkey): add integration tests
refactor(frontend): improve error handling
```

**Types:**

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `security`: Security improvements

## 🧪 Testing Requirements

### Required Tests for PR Acceptance

1. **Unit Tests**: All new functions must have unit tests
2. **Integration Tests**: WebAuthn flows must be integration tested
3. **Security Tests**: Authentication flows must be security tested
4. **Browser Tests**: Frontend changes need cross-browser testing

```bash
# Run all tests
npm run test

# Run specific workspace tests
npm test -w aastar
npm test -w signer
npm test -w aastar-frontend

# Run smart contract tests
cd validator && forge test
```

## 🔒 Security Guidelines

### WebAuthn/Passkey Security

- ✅ Always require user verification (`userVerification: "required"`)
- ✅ Use discoverable credentials (`residentKey: "required"`)
- ✅ Validate origin and RP ID strictly
- ✅ Never log or expose credentials
- ✅ Handle timeouts and cancellations gracefully

### BLS Signature Security

- ✅ Validate all public keys before aggregation
- ✅ Verify message point integrity
- ✅ Use constant-time operations where possible
- ✅ Implement replay protection

### Smart Contract Security

- ✅ Follow checks-effects-interactions pattern
- ✅ Implement proper access controls
- ✅ Add reentrancy guards where needed
- ✅ Validate all external calls

## 📋 Pull Request Process

1. **Branch Naming**: `feature/description` or `fix/description`
2. **PR Title**: Use conventional commit format
3. **Description**: Use our PR template (auto-populated)
4. **Tests**: Ensure all tests pass
5. **Documentation**: Update docs if needed
6. **Security**: Consider security implications

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] WebAuthn flows tested
- [ ] BLS signatures verified
- [ ] Smart contracts tested
- [ ] Breaking changes documented

## 🎯 Areas We Need Help

### 🔐 Authentication & Security

- Additional WebAuthn authenticator support
- Enhanced error handling and recovery
- Security audit improvements
- Multi-factor authentication options

### ⚡ Performance & Optimization

- BLS signature optimization
- Gas cost reduction techniques
- Frontend performance improvements
- Database query optimization

### 🌐 Platform Support

- Mobile app development
- Desktop application
- Browser extension
- Hardware wallet integration

### 📚 Documentation & Examples

- More code examples
- Video tutorials
- Integration guides
- API documentation

### 🧪 Testing & QA

- Automated testing improvements
- Cross-browser testing
- Load testing
- Security testing

## 📖 Development Guidelines

### Code Style

We use Prettier and ESLint. Run before committing:

```bash
npm run format      # Format all code
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Project Structure

```
/aastar             # Backend API (NestJS)
  /src/auth/        # WebAuthn authentication
  /src/transfer/    # Transaction handling
  /src/bls/         # BLS integration

/aastar-frontend    # Frontend (Next.js)
  /app/auth/        # Authentication pages
  /app/transfer/    # Transaction interface
  /lib/             # Utilities and API client

/signer             # BLS Signer Service
  /src/modules/bls/ # BLS cryptography
  /src/modules/gossip/ # P2P networking

/validator          # Smart Contracts (Foundry)
  /src/             # Solidity contracts
  /test/            # Contract tests
```

### API Guidelines

- Use TypeScript everywhere
- Follow OpenAPI/Swagger standards
- Implement proper error handling
- Add comprehensive logging
- Include input validation
- Document all endpoints

## 🐛 Bug Reports

Use GitHub Issues with our bug report template:

- **Bug description**: Clear and concise
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Screenshots**: If applicable
- **Environment**: OS, browser, versions
- **Security impact**: If security-related

## 💡 Feature Requests

Use GitHub Issues with our feature request template:

- **Feature description**: What you want
- **Motivation**: Why it's needed
- **Proposed solution**: How it could work
- **Alternatives considered**: Other options
- **Additional context**: Examples, mockups

## 📞 Getting Help

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Code Review**: Submit PRs for feedback
- **Discord**: Join our community (link coming soon)

## 🏆 Recognition

Contributors will be:

- ✨ Listed in our contributors section
- 🎖️ Credited in release notes
- 📱 Featured in project updates
- 🌟 Highlighted in documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the
MIT License.

---

Thank you for making YetAnotherAA better for everyone! 🙏
