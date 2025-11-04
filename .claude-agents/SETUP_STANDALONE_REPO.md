# Setting Up Unicity Expert Agents as a Standalone Git Repository

This guide explains how to create a standalone git repository for the Unicity Expert Agents package that can be easily distributed and installed by users.

## Prerequisites

- Git installed on your system
- GitHub account (or GitLab/Bitbucket)
- Terminal/command line access

## Step-by-Step Setup Guide

### Step 1: Prepare the Directory Structure

First, copy the `.claude-agents` directory to a new location where you'll create the standalone repository:

```bash
# Create a new directory for the standalone repo
mkdir ~/unicity-expert-agents
cd ~/unicity-expert-agents

# Copy the expert agents content
cp -r /path/to/cli/.claude-agents/* .

# Verify the structure
ls -la
# Should show:
# - README.md
# - unicity-experts/
# - unicity-research/
```

### Step 2: Initialize Git Repository

```bash
# Initialize git repository
git init

# Check what files are present
git status
```

### Step 3: Create Essential Repository Files

#### 3.1 Create LICENSE File

```bash
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 Unicity Network

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

**Note:** Replace with your preferred license (MIT, Apache 2.0, etc.)

#### 3.2 Create .gitignore

```bash
cat > .gitignore << 'EOF'
# Editor and IDE files
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# OS files
Thumbs.db
desktop.ini

# Temporary files
*.tmp
*.bak
*.log

# Python cache (if using Python scripts)
__pycache__/
*.py[cod]
*$py.class

# Node modules (if you add any tooling)
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Distribution files
dist/
build/
*.zip
*.tar.gz
EOF
```

#### 3.3 Create .gitattributes (Optional, for consistent line endings)

```bash
cat > .gitattributes << 'EOF'
# Auto detect text files and normalize line endings to LF
* text=auto eol=lf

# Explicitly set markdown files to use LF
*.md text eol=lf

# Scripts should always use LF
*.sh text eol=lf
*.bash text eol=lf

# Ensure Windows batch files use CRLF
*.bat text eol=crlf
*.cmd text eol=crlf
EOF
```

#### 3.4 Create CHANGELOG.md

```bash
cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to the Unicity Expert Agents project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-04

### Added
- Initial release of Unicity Expert Agents
- 4 comprehensive expert agent profiles:
  - Unicity Architect (19 KB, 740 lines)
  - Consensus Expert (21 KB, 805 lines)
  - Proof Aggregator Expert (61 KB, 2,343 lines)
  - Unicity Developers (34 KB, 1,266 lines)
- 16 supporting research documents (444 KB total)
- Complete installation and usage documentation
- Integration guides for Claude Code and Cursor IDE
- 100+ code examples across TypeScript, Java, and Rust
- Analysis of 25+ Unicity Network repositories

### Research Coverage
- Consensus mechanisms: PoW (RandomX) and BFT
- Aggregator layer: API, deployment, operations
- SDK documentation: TypeScript v1.6.0, Java v1.3.0, Rust v0.1.0
- Architecture: Four-layer design, off-chain execution paradigm

## [Unreleased]

### Planned
- Video tutorials for each expert domain
- Interactive examples and code playgrounds
- Additional language SDKs as they become available
- Performance benchmarking documentation
- Security audit reports
EOF
```

#### 3.5 Create CONTRIBUTING.md

```bash
cat > CONTRIBUTING.md << 'EOF'
# Contributing to Unicity Expert Agents

Thank you for your interest in contributing to the Unicity Expert Agents project! This document provides guidelines for contributing.

## How to Contribute

### Reporting Issues

If you find any errors, outdated information, or have suggestions for improvements:

1. Check existing issues to avoid duplicates
2. Open a new issue with:
   - Clear description of the problem
   - Expected vs actual behavior
   - Steps to reproduce (if applicable)
   - Suggested fix (optional)

### Updating Expert Profiles

If you want to update or improve expert profiles:

1. Fork the repository
2. Create a feature branch: `git checkout -b update-architecture-docs`
3. Make your changes
4. Ensure markdown formatting is consistent
5. Submit a pull request with:
   - Clear description of changes
   - Rationale for updates
   - Links to sources (if adding new information)

### Adding New Expert Domains

To propose a new expert agent profile:

1. Open an issue first to discuss the scope
2. Research the domain thoroughly (reference 5+ repositories)
3. Follow the existing profile structure:
   - Executive summary
   - Key knowledge areas
   - Code examples
   - Integration patterns
   - Best practices
4. Include supporting research documentation
5. Submit PR with comprehensive documentation

### Documentation Standards

- Use clear, concise language
- Include code examples where appropriate
- Reference official Unicity repositories
- Test all code examples before submitting
- Use markdown formatting consistently
- Add table of contents for documents >100 lines

### Code Examples

When adding code examples:

- Ensure they are production-ready
- Test them against latest SDK versions
- Include error handling
- Add comments explaining key concepts
- Show both basic and advanced usage

### Research Updates

When updating research documentation:

- Cite sources (repository links, commits, releases)
- Include version numbers for SDKs
- Date your research findings
- Note breaking changes between versions
- Update changelog

## Review Process

1. Submit your pull request
2. Maintainers will review within 5 business days
3. Address any feedback or requested changes
4. Once approved, your contribution will be merged
5. You'll be credited in the changelog

## Questions?

Open an issue or discussion on GitHub if you have questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).
EOF
```

### Step 4: Create a Comprehensive README (if not already updated)

The README.md we updated in the previous step should be at the root. Verify it's complete.

### Step 5: Add Version Information

Create a VERSION file:

```bash
echo "1.0.0" > VERSION
```

### Step 6: Create Package Metadata (Optional, for package managers)

#### For npm (if you want to publish to npm registry)

```bash
cat > package.json << 'EOF'
{
  "name": "@unicitynetwork/expert-agents",
  "version": "1.0.0",
  "description": "Comprehensive AI assistant expert profiles for the Unicity Network",
  "keywords": [
    "unicity",
    "blockchain",
    "ai-agents",
    "expert-systems",
    "documentation",
    "claude",
    "state-transition",
    "consensus",
    "aggregator"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/unicitynetwork/unicity-expert-agents.git"
  },
  "homepage": "https://github.com/unicitynetwork/unicity-expert-agents#readme",
  "bugs": {
    "url": "https://github.com/unicitynetwork/unicity-expert-agents/issues"
  },
  "author": "Unicity Network",
  "license": "MIT",
  "files": [
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "unicity-experts/",
    "unicity-research/"
  ]
}
EOF
```

### Step 7: Stage All Files

```bash
# Add all files to git
git add .

# Verify what will be committed
git status

# Review the files
git diff --cached --stat
```

### Step 8: Create Initial Commit

```bash
git commit -m "Initial release: Unicity Expert Agents v1.0.0

Comprehensive AI assistant expert profiles for Unicity Network:

- 4 Expert Agent Profiles (148 KB)
  * Unicity Architect
  * Consensus Expert
  * Proof Aggregator Expert
  * Unicity Developers (TypeScript, Java, Rust)

- 16 Research Documents (444 KB)
  * Architecture analysis
  * Consensus implementation guides
  * Aggregator API documentation
  * SDK reference for all languages

- Complete Installation & Usage Documentation
- 100+ code examples
- 25+ repositories analyzed
- 608 KB total expert knowledge base"
```

### Step 9: Create GitHub Repository

#### Option A: Using GitHub CLI (gh)

```bash
# Login to GitHub CLI (if not already logged in)
gh auth login

# Create the repository
gh repo create unicitynetwork/unicity-expert-agents \
  --public \
  --description "Comprehensive AI assistant expert profiles for Unicity Network" \
  --homepage "https://github.com/unicitynetwork/unicity-expert-agents"

# Push to GitHub
git remote add origin https://github.com/unicitynetwork/unicity-expert-agents.git
git branch -M main
git push -u origin main
```

#### Option B: Using GitHub Web Interface

1. Go to https://github.com/new
2. Fill in repository details:
   - **Repository name:** `unicity-expert-agents`
   - **Description:** "Comprehensive AI assistant expert profiles for Unicity Network"
   - **Visibility:** Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
3. Click "Create repository"
4. Follow the instructions to push existing repository:

```bash
git remote add origin https://github.com/unicitynetwork/unicity-expert-agents.git
git branch -M main
git push -u origin main
```

### Step 10: Create a Release

#### Using GitHub Web Interface

1. Go to your repository on GitHub
2. Click "Releases" → "Create a new release"
3. Fill in:
   - **Tag version:** `v1.0.0`
   - **Release title:** `v1.0.0 - Initial Release`
   - **Description:**
     ```markdown
     ## Unicity Expert Agents v1.0.0

     Initial release of comprehensive AI assistant expert profiles for Unicity Network.

     ### What's Included
     - 4 Expert Agent Profiles (148 KB)
     - 16 Research Documents (444 KB)
     - 100+ Code Examples
     - 25+ Repositories Analyzed

     ### Expert Domains
     - **Unicity Architect**: Architecture and design principles
     - **Consensus Expert**: PoW and BFT consensus mechanisms
     - **Proof Aggregator Expert**: Aggregator layer and API
     - **Unicity Developers**: SDKs for TypeScript, Java, Rust

     ### Installation
     See [README.md](README.md) for installation instructions.

     ### Total Package Size
     608 KB of expert knowledge ready to use!
     ```
4. Click "Publish release"

#### Using GitHub CLI

```bash
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "Initial release of Unicity Expert Agents with 4 expert profiles and 16 research documents"
```

### Step 11: Add Repository Topics/Tags

On GitHub, go to your repository and add topics:

```
unicity
blockchain
ai-agents
expert-systems
claude
documentation
state-transition
consensus
aggregator
sdk
typescript
java
rust
```

### Step 12: Enable GitHub Pages (Optional)

If you want to host documentation as a website:

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main`, folder: `/ (root)`
4. Click Save

Your documentation will be available at:
`https://unicitynetwork.github.io/unicity-expert-agents/`

### Step 13: Set Up Branch Protection (Recommended)

1. Go to Settings → Branches
2. Add branch protection rule for `main`:
   - Require pull request reviews before merging
   - Require status checks to pass
   - Include administrators (optional)

## Verification Checklist

Before making the repository public, verify:

- [ ] README.md has clear installation instructions
- [ ] LICENSE file is present and appropriate
- [ ] .gitignore excludes unnecessary files
- [ ] CHANGELOG.md is up to date
- [ ] All expert profiles are present and formatted correctly
- [ ] All research documents are present
- [ ] No sensitive information is committed
- [ ] Repository description is clear
- [ ] Topics/tags are added
- [ ] Initial release is created

## Post-Setup Tasks

### 1. Add Repository Badges

Add to README.md:

```markdown
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Size](https://img.shields.io/badge/size-608KB-orange)
![Profiles](https://img.shields.io/badge/profiles-4-purple)
![Docs](https://img.shields.io/badge/research%20docs-16-red)
```

### 2. Create Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md` and `feature_request.md`

### 3. Set Up GitHub Actions (Optional)

Create `.github/workflows/validate.yml` to validate markdown formatting, check links, etc.

### 4. Announce the Repository

- Post on Unicity community channels
- Share on social media
- Add link to main Unicity documentation

## Updating the Repository

When making updates:

```bash
# Create feature branch
git checkout -b update-consensus-docs

# Make changes
# ... edit files ...

# Commit changes
git add .
git commit -m "Update consensus documentation with latest BFT changes"

# Push to GitHub
git push origin update-consensus-docs

# Create pull request on GitHub
gh pr create --title "Update consensus documentation" --body "Details of changes"
```

## Maintenance

### Regular Updates
- Check Unicity repositories quarterly for updates
- Update SDK versions when new releases occur
- Add new expert domains as ecosystem grows
- Respond to issues and PRs promptly

### Version Bumping
- Patch (1.0.x): Bug fixes, typos, small improvements
- Minor (1.x.0): New research docs, expanded expert profiles
- Major (x.0.0): New expert domains, restructuring

---

## Quick Command Summary

```bash
# Complete setup in one go
mkdir ~/unicity-expert-agents
cd ~/unicity-expert-agents
cp -r /path/to/cli/.claude-agents/* .
git init
# Create LICENSE, .gitignore, CHANGELOG.md, CONTRIBUTING.md (as shown above)
git add .
git commit -m "Initial release: Unicity Expert Agents v1.0.0"
gh repo create unicitynetwork/unicity-expert-agents --public
git remote add origin https://github.com/unicitynetwork/unicity-expert-agents.git
git branch -M main
git push -u origin main
gh release create v1.0.0 --title "v1.0.0 - Initial Release"
```

---

## Support

If you encounter issues during setup:
1. Check this guide thoroughly
2. Review GitHub's documentation
3. Open an issue on the repository
4. Contact Unicity Network team

Good luck with your standalone repository! 🚀
