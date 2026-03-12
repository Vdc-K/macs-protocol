# MACS v2.3 Release Checklist

## ✅ Pre-Release (Code Complete)

- [x] Markdown AST Indexer implemented
  - [x] types.ts (data structures)
  - [x] markdown-indexer.ts (parser)
  - [x] query-engine.ts (query API)
  - [x] index.ts (CLI)
- [x] Dashboard implemented
  - [x] server.ts (HTTP server)
  - [x] analyzer.ts (data extraction)
  - [x] ui/ (frontend)
- [x] CLI tool (`macs` command)
- [x] Demo project tested (/tmp/macs-demo)
- [x] Bug fixes
  - [x] Heading depth (## vs ###)
  - [x] Emoji in type tags ([✨ feat])
- [x] Documentation
  - [x] TECHNICAL-FEATURES.md
  - [x] CHANGELOG.md updated
  - [x] README.md updated
  - [x] DEMO-SCRIPT.md created

## 📦 Release Preparation

### Code

- [ ] Install dependencies in both packages
  ```bash
  cd .macs/tools && npm install && cd -
  cd .macs/dashboard && npm install && cd -
  ```
- [ ] Test on clean machine (or VM)
- [ ] Verify all scripts are executable
  ```bash
  chmod +x scripts/macs scripts/init.sh
  ```
- [ ] Version bump
  - [ ] package.json files (tools + dashboard)
  - [ ] CHANGELOG.md
  - [ ] README.md

### Documentation

- [ ] Create ARCHITECTURE.md (technical deep dive)
- [ ] Create API.md (QueryEngine API reference)
- [ ] Update QUICKSTART.md with v2.3 commands
- [ ] Update FAQ.md with token savings questions

### Examples

- [ ] Create `examples/real-world/` with actual MACS-managed project
- [ ] Include before/after token usage comparison
- [ ] Include dashboard screenshots

### Testing

- [ ] Test `macs init`
- [ ] Test `macs index`
- [ ] Test `macs stats`
- [ ] Test `macs query`
- [ ] Test `macs dashboard`
- [ ] Cross-platform test (macOS + Linux)

## 🚀 GitHub Release

### Repository Setup

- [ ] Create GitHub repo: `your-org/macs`
- [ ] Add description: "Multi-Agent Collaboration System - 99% token reduction via Markdown AST indexing"
- [ ] Add topics: `ai`, `multi-agent`, `llm`, `collaboration`, `markdown`, `opensource`
- [ ] Add LICENSE file (MIT)
- [ ] Add .gitignore
- [ ] Add CONTRIBUTING.md

### Release Notes

- [ ] Create GitHub release v2.3.0
- [ ] Copy content from RELEASE-NOTES-v2.3.md
- [ ] Add tarball: `git archive -o macs-v2.3.0.tar.gz HEAD`
- [ ] Add installation instructions

### Screenshots

Capture and add to `docs/screenshots/`:
- [ ] Terminal: `macs stats` output
- [ ] Dashboard: Stats overview
- [ ] Dashboard: Timeline
- [ ] Dashboard: Heatmap
- [ ] Dashboard: Escalations
- [ ] Code: QueryEngine API usage

### Tags

```bash
git tag -a v2.3.0 -m "v2.3.0: AST Indexing + Dashboard"
git push origin v2.3.0
```

## 📢 Launch

### Week 1: Soft Launch

**Day 1: GitHub**
- [ ] Push to GitHub
- [ ] Write launch tweet
- [ ] Share in OpenClaw community

**Day 2-3: Content**
- [ ] Publish technical blog post (TECHNICAL-FEATURES.md)
- [ ] Record 5-min demo video (DEMO-SCRIPT.md)
- [ ] Upload to YouTube

**Day 4-5: Communities**
- [ ] Post on HackerNews (Show HN)
- [ ] Share on Reddit: r/MachineLearning, r/LangChain
- [ ] Share on Discord: OpenAI, Anthropic communities

### Week 2: Feedback Loop

- [ ] Monitor GitHub issues
- [ ] Respond to HN comments
- [ ] Collect feature requests
- [ ] Fix critical bugs (if any)

### Week 3: ProductHunt (Optional)

- [ ] Prepare ProductHunt listing
- [ ] Create demo GIF/video
- [ ] Schedule launch date
- [ ] Notify supporters

## 🎯 Success Metrics

**Week 1 Goals**:
- [ ] 50+ GitHub stars
- [ ] 10+ HackerNews upvotes
- [ ] 3+ community feedback messages

**Month 1 Goals**:
- [ ] 200+ GitHub stars
- [ ] 5+ community contributors
- [ ] 1+ external blog post/mention

**Quarter 1 Goals**:
- [ ] 1K+ GitHub stars
- [ ] 10K+ users (estimated via clones)
- [ ] Partnership discussions with Claude Code / Cursor

## 🐛 Known Issues / Limitations

Document these in GitHub Issues:

1. **Parser Limitations**
   - Doesn't handle nested lists in CHANGELOG
   - Assumes standard format (breaks on custom syntax)

2. **Dashboard**
   - No authentication (runs on localhost only)
   - No persistence (refreshes from files every time)

3. **Cross-Platform**
   - Not tested on Windows
   - Requires Node.js 18+

4. **Performance**
   - Large projects (10K+ entries) not tested
   - Dashboard might slow down with 1000+ changes

Mark these as "help wanted" for community contributions.

## 📋 Post-Release

### v2.3.1 (Hotfix - if needed)
- Bug fixes from community feedback
- Documentation improvements

### v2.4 (Next Feature Release)
- Conflict resolver (3-way merge for TASK.md)
- Enhanced data structures (relationships, metadata)
- Graph visualization (task dependencies)

### v3.0 (Major Release)
- QMD integration (semantic search)
- Skill capsule registry
- Multi-LLM adapter layer

---

## Quick Launch Commands

```bash
# Prepare release
cd /Users/jarvis/Documents/macs-skill
git add .
git commit -m "Release v2.3.0: AST Indexing + Dashboard"
git tag -a v2.3.0 -m "v2.3.0: AST Indexing + Dashboard"

# Create GitHub repo (via gh CLI)
gh repo create macs --public --description "Multi-Agent Collaboration System - 99% token reduction"
git remote add origin https://github.com/your-org/macs.git
git push -u origin main
git push origin v2.3.0

# Create release
gh release create v2.3.0 \
  --title "v2.3.0: AST Indexing + Dashboard" \
  --notes-file RELEASE-NOTES-v2.3.md

# Share
echo "🚀 MACS v2.3.0 is live!"
echo "GitHub: https://github.com/your-org/macs"
echo "Demo: [upload video first]"
```
