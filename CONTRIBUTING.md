# Contributing to MACS

Thank you for your interest in contributing to MACS (Multi-Agent Collaboration System)!

## How to Contribute

### 1. Report Issues

- Use GitHub Issues for bug reports and feature requests
- Search existing issues first to avoid duplicates
- Provide clear reproduction steps for bugs
- Use issue templates (if available)

### 2. Improve Documentation

- Fix typos, clarify explanations
- Add examples for common use cases
- Translate documentation (we support EN/CN, more languages welcome)

### 3. Submit Code

**Before starting**:
- Open an issue to discuss major changes
- Check existing PRs to avoid duplicates

**Development workflow**:
```bash
# Fork the repo
git clone https://github.com/your-username/macs.git
cd macs

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes and test
./scripts/init.sh test-project
# Verify templates work correctly

# Commit with clear messages
git commit -m "feat: add skill capsule validation"

# Push and create PR
git push origin feature/your-feature-name
```

**Commit message format**:
```
<type>: <description>

[optional body]
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### 4. Create Skill Capsules

We welcome community skill capsules! See [SKILL-CAPSULES.md](docs/SKILL-CAPSULES.md) for guidelines.

**Quality standards**:
- Include `capsule.yaml` with environment fingerprint
- Provide usage examples in `WHEN-TO-USE.md`
- Document edge cases in `EDGE-CASES.md`
- Add tests where applicable

## Code Review Process

1. Maintainers review PRs within 3-5 business days
2. Address feedback and update PR
3. Once approved, maintainers will merge
4. Your contribution will be credited in CHANGELOG.md

## Community Guidelines

- Be respectful and constructive
- Help others in issues and discussions
- Share your use cases and learnings
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)

## Questions?

- Open a GitHub Discussion
- Join OpenClaw community channels
- Reach out to maintainers

---

**First-time contributor?** Look for issues tagged `good-first-issue`.
