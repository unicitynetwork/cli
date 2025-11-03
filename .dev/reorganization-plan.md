# Unicity CLI Project Reorganization Plan

**Analysis Date**: 2025-11-03
**Reviewer**: Claude Code (Software Architecture Expert)
**Status**: PROPOSAL - Awaiting approval before execution

---

## Executive Summary

This document provides a comprehensive plan to reorganize the Unicity CLI project structure according to TypeScript/Node.js CLI best practices. The current project has 30+ markdown files in the root directory, test scripts scattered throughout, and a `claude/` folder that should be archived. The proposed structure follows conventions from popular CLI tools (npm, git, typescript) while maintaining documentation discoverability and developer workflow efficiency.

**Key Changes:**
- Move 30+ documentation files into organized subdirectories
- Clean up root directory (keep only essential files)
- Archive development artifacts to prevent clutter
- Separate user documentation from developer documentation
- Organize by document type and user journey
- Update all internal references and links

**Impact**: Zero breaking changes to functionality, improved project maintainability and documentation discoverability.

---

## Current State Analysis

### Root Directory Files (57 items)

**Documentation (30 markdown files):**
- User guides: GETTING_STARTED.md, GLOSSARY.md
- Command guides: GEN_ADDRESS_GUIDE.md, MINT_TOKEN_GUIDE.md, SEND_TOKEN_GUIDE.md, RECEIVE_TOKEN_GUIDE.md, VERIFY_TOKEN_GUIDE.md, SEND_TOKEN_QUICKREF.md
- Workflow guides: TRANSFER_GUIDE.md, OFFLINE_TRANSFER_WORKFLOW.md
- Tutorial series: TUTORIAL_1_FIRST_TOKEN.md through TUTORIAL_5_PRODUCTION_PRACTICES.md, TUTORIALS_INDEX.md, TUTORIALS_QUICK_START.md, TUTORIALS_SUMMARY.md
- Reference docs: API_REFERENCE.md, TXF_IMPLEMENTATION_GUIDE.md, DOCUMENTATION_INDEX.md
- Enhanced docs: README_ENHANCED.md, README_TUTORIALS.md
- Developer docs: CLAUDE.md, IMPLEMENTATION_SUMMARY.md
- Analysis/summary docs: DOCUMENTATION_ANALYSIS.md, DOCUMENTATION_IMPROVEMENTS_SUMMARY.md, DOCUMENTATION_TODO.md, TUTORIAL_DELIVERY_SUMMARY.md, FINDINGS.md
- Main README: README.md

**Test Scripts (5 JavaScript files):**
- test-address-to-predicate.js
- test-mint-style-commitment.js
- test-token-reload.js
- test-with-minter-secret.js
- verify-predicate-encoding.js

**Token Files (10 .txf files):**
- Various timestamped token files (20251102_*.txf)

**Configuration Files:**
- package.json, package-lock.json, tsconfig.json, .gitignore

**Directories:**
- `src/` - TypeScript source code
- `dist/` - Compiled JavaScript (ignored in git)
- `node_modules/` - Dependencies (ignored in git)
- `ref_materials/` - Symlinks to external projects (ignored in git)
- `claude/` - Development artifacts and analysis (ignored in git)
- `.claude/` - Claude Code settings

### Problems with Current Structure

1. **Cluttered root directory**: 30+ markdown files make it hard to find essential files
2. **Poor documentation organization**: No clear distinction between user guides, tutorials, and technical references
3. **Test scripts in root**: Should be in dedicated test directory
4. **Token files in root**: Should be in examples or ignored
5. **Multiple "alternative" README files**: Confusing which is canonical
6. **Development artifacts**: Summary/analysis docs should be archived
7. **No clear documentation hierarchy**: Flat structure doesn't guide users through learning path

---

## Proposed Folder Structure

```
unicity-cli/
├── README.md                          # Main project readme (updated)
├── CHANGELOG.md                       # Version history (create if needed)
├── LICENSE                            # Project license (if applicable)
├── package.json                       # NPM configuration
├── package-lock.json                  # Dependency lock file
├── tsconfig.json                      # TypeScript configuration
├── .gitignore                         # Git ignore rules
│
├── docs/                              # User-facing documentation
│   ├── README.md                      # Documentation index (from DOCUMENTATION_INDEX.md)
│   ├── getting-started.md             # Quick start guide
│   ├── glossary.md                    # Terminology reference
│   │
│   ├── guides/                        # Command & workflow guides
│   │   ├── commands/                  # Individual command guides
│   │   │   ├── gen-address.md
│   │   │   ├── mint-token.md
│   │   │   ├── send-token.md
│   │   │   ├── receive-token.md
│   │   │   ├── verify-token.md
│   │   │   └── send-token-quickref.md
│   │   │
│   │   └── workflows/                 # End-to-end workflows
│   │       ├── transfer-guide.md
│   │       └── offline-transfer.md
│   │
│   ├── tutorials/                     # Progressive learning path
│   │   ├── README.md                  # Tutorial index (from TUTORIALS_INDEX.md)
│   │   ├── quick-start.md             # Tutorial quick start
│   │   ├── 01-first-token.md
│   │   ├── 02-token-transfers.md
│   │   ├── 03-advanced-operations.md
│   │   ├── 04-token-internals.md
│   │   └── 05-production-practices.md
│   │
│   └── reference/                     # Technical reference docs
│       ├── api-reference.md           # Complete API reference
│       └── txf-format.md              # TXF implementation guide
│
├── examples/                          # Example files and scripts
│   ├── tokens/                        # Example .txf token files
│   │   └── .gitkeep
│   └── scripts/                       # Example integration scripts
│       └── .gitkeep
│
├── tests/                             # Test files
│   ├── unit/                          # Unit tests (future)
│   ├── integration/                   # Integration tests (future)
│   └── scripts/                       # Test/debug scripts
│       ├── test-address-to-predicate.js
│       ├── test-mint-style-commitment.js
│       ├── test-token-reload.js
│       ├── test-with-minter-secret.js
│       └── verify-predicate-encoding.js
│
├── src/                               # TypeScript source code
│   ├── index.ts                       # CLI entry point
│   ├── commands/                      # Command implementations
│   │   ├── gen-address.ts
│   │   ├── mint-token.ts
│   │   ├── send-token.ts
│   │   ├── receive-token.ts
│   │   ├── verify-token.ts
│   │   ├── get-request.ts
│   │   └── register-request.ts
│   ├── types/                         # TypeScript type definitions
│   │   └── extended-txf.ts
│   └── utils/                         # Utility functions
│       └── transfer-validation.ts
│
├── .github/                           # GitHub-specific files (if using GitHub)
│   ├── workflows/                     # CI/CD workflows
│   └── ISSUE_TEMPLATE/                # Issue templates
│
├── .dev/                              # Development documentation & artifacts
│   ├── README.md                      # Developer guide (from CLAUDE.md)
│   ├── implementation-notes.md        # Implementation details
│   ├── findings.md                    # Technical findings/investigations
│   └── archives/                      # Archived analysis documents
│       ├── documentation-analysis.md
│       ├── documentation-improvements.md
│       ├── documentation-todo.md
│       ├── tutorial-delivery.md
│       └── readme-alternatives/       # Alternative README versions
│           ├── README_ENHANCED.md
│           └── README_TUTORIALS.md
│
├── dist/                              # Compiled output (git-ignored)
├── node_modules/                      # Dependencies (git-ignored)
├── ref_materials/                     # Reference materials (git-ignored)
└── .claude/                           # Claude Code settings
```

---

## File Categorization & Migration Table

### Core Project Files (Stay in Root)

| Current Location | New Location | Action | Reason |
|------------------|--------------|--------|--------|
| `README.md` | `README.md` | **Update** | Main entry point, stays in root |
| `package.json` | `package.json` | **Keep** | NPM convention |
| `package-lock.json` | `package-lock.json` | **Keep** | NPM convention |
| `tsconfig.json` | `tsconfig.json` | **Keep** | TypeScript convention |
| `.gitignore` | `.gitignore` | **Update** | Git convention, update paths |

### Documentation Files

#### User Documentation → `docs/`

| Current Location | New Location | Action | Notes |
|------------------|--------------|--------|-------|
| `GETTING_STARTED.md` | `docs/getting-started.md` | Move | Main entry for new users |
| `GLOSSARY.md` | `docs/glossary.md` | Move | Terminology reference |
| `DOCUMENTATION_INDEX.md` | `docs/README.md` | Move + Rename | Documentation navigation |

#### Command Guides → `docs/guides/commands/`

| Current Location | New Location | Action |
|------------------|--------------|--------|
| `GEN_ADDRESS_GUIDE.md` | `docs/guides/commands/gen-address.md` | Move |
| `MINT_TOKEN_GUIDE.md` | `docs/guides/commands/mint-token.md` | Move |
| `SEND_TOKEN_GUIDE.md` | `docs/guides/commands/send-token.md` | Move |
| `RECEIVE_TOKEN_GUIDE.md` | `docs/guides/commands/receive-token.md` | Move |
| `VERIFY_TOKEN_GUIDE.md` | `docs/guides/commands/verify-token.md` | Move |
| `SEND_TOKEN_QUICKREF.md` | `docs/guides/commands/send-token-quickref.md` | Move |

#### Workflow Guides → `docs/guides/workflows/`

| Current Location | New Location | Action |
|------------------|--------------|--------|
| `TRANSFER_GUIDE.md` | `docs/guides/workflows/transfer-guide.md` | Move |
| `OFFLINE_TRANSFER_WORKFLOW.md` | `docs/guides/workflows/offline-transfer.md` | Move |

#### Tutorials → `docs/tutorials/`

| Current Location | New Location | Action | Notes |
|------------------|--------------|--------|-------|
| `TUTORIALS_INDEX.md` | `docs/tutorials/README.md` | Move + Rename | Tutorial navigation |
| `TUTORIALS_QUICK_START.md` | `docs/tutorials/quick-start.md` | Move | |
| `TUTORIAL_1_FIRST_TOKEN.md` | `docs/tutorials/01-first-token.md` | Move | Numbered for ordering |
| `TUTORIAL_2_TOKEN_TRANSFERS.md` | `docs/tutorials/02-token-transfers.md` | Move | |
| `TUTORIAL_3_ADVANCED_OPERATIONS.md` | `docs/tutorials/03-advanced-operations.md` | Move | |
| `TUTORIAL_4_TOKEN_INTERNALS.md` | `docs/tutorials/04-token-internals.md` | Move | |
| `TUTORIAL_5_PRODUCTION_PRACTICES.md` | `docs/tutorials/05-production-practices.md` | Move | |
| `TUTORIALS_SUMMARY.md` | `.dev/archives/tutorials-summary.md` | Archive | Analysis doc |

#### Reference Documentation → `docs/reference/`

| Current Location | New Location | Action |
|------------------|--------------|--------|
| `API_REFERENCE.md` | `docs/reference/api-reference.md` | Move |
| `TXF_IMPLEMENTATION_GUIDE.md` | `docs/reference/txf-format.md` | Move |

#### Developer Documentation → `.dev/`

| Current Location | New Location | Action | Notes |
|------------------|--------------|--------|-------|
| `CLAUDE.md` | `.dev/README.md` | Move + Rename | Main developer guide |
| `IMPLEMENTATION_SUMMARY.md` | `.dev/implementation-notes.md` | Move + Rename | Implementation details |
| `FINDINGS.md` | `.dev/findings.md` | Move | Technical investigation |

#### Analysis/Summary Documents → `.dev/archives/`

| Current Location | New Location | Action | Reason |
|------------------|--------------|--------|--------|
| `DOCUMENTATION_ANALYSIS.md` | `.dev/archives/documentation-analysis.md` | Archive | Historical analysis |
| `DOCUMENTATION_IMPROVEMENTS_SUMMARY.md` | `.dev/archives/documentation-improvements.md` | Archive | Historical summary |
| `DOCUMENTATION_TODO.md` | `.dev/archives/documentation-todo.md` | Archive | Completed TODO list |
| `TUTORIAL_DELIVERY_SUMMARY.md` | `.dev/archives/tutorial-delivery.md` | Archive | Historical summary |
| `README_ENHANCED.md` | `.dev/archives/readme-alternatives/README_ENHANCED.md` | Archive | Alternative version |
| `README_TUTORIALS.md` | `.dev/archives/readme-alternatives/README_TUTORIALS.md` | Archive | Alternative version |

### Test Scripts → `tests/scripts/`

| Current Location | New Location | Action |
|------------------|--------------|--------|
| `test-address-to-predicate.js` | `tests/scripts/test-address-to-predicate.js` | Move |
| `test-mint-style-commitment.js` | `tests/scripts/test-mint-style-commitment.js` | Move |
| `test-token-reload.js` | `tests/scripts/test-token-reload.js` | Move |
| `test-with-minter-secret.js` | `tests/scripts/test-with-minter-secret.js` | Move |
| `verify-predicate-encoding.js` | `tests/scripts/verify-predicate-encoding.js` | Move |

### Token Files → Archive or Clean

| Current Location | Action | Reason |
|------------------|--------|--------|
| `*.txf` files (10 files) | **Delete or move to `examples/tokens/`** | These are test artifacts, not part of project |

### Directories

| Current Location | New Location | Action | Notes |
|------------------|--------------|--------|-------|
| `src/` | `src/` | **Keep** | No changes to source structure |
| `dist/` | `dist/` | **Keep** | Build output (git-ignored) |
| `node_modules/` | `node_modules/` | **Keep** | Dependencies (git-ignored) |
| `ref_materials/` | `ref_materials/` | **Keep** | External references (git-ignored) |
| `claude/` | **Delete** | Git-ignored, development artifacts |

---

## Reasoning for Organizational Decisions

### 1. Documentation in `docs/` Directory

**Why:**
- Standard convention for CLI tools (git, npm, typescript)
- Separates documentation from code
- Makes it clear where to find user-facing docs
- Allows for subdirectory organization by type

**Subdirectory Structure:**
- `docs/guides/commands/` - Command-specific documentation (reference material)
- `docs/guides/workflows/` - End-to-end workflows (how multiple commands work together)
- `docs/tutorials/` - Progressive learning path (step-by-step tutorials)
- `docs/reference/` - Technical reference (API docs, format specs)

### 2. Developer Documentation in `.dev/`

**Why:**
- Separates developer docs from user docs
- Hidden directory (starts with `.`) indicates "not for end users"
- Contains development artifacts, implementation notes, findings
- Archives historical analysis documents

**Alternative Considered:** `dev/` (without dot)
- **Rejected:** Not hidden, might confuse users browsing docs

### 3. Test Scripts in `tests/scripts/`

**Why:**
- Standard convention for test files
- Separates test code from source code
- `tests/scripts/` allows for future organization:
  - `tests/unit/` - Unit tests (when added)
  - `tests/integration/` - Integration tests (when added)
  - `tests/scripts/` - Debug/test scripts

### 4. Examples in `examples/` Directory

**Why:**
- Standard convention for example files
- Clear location for token file examples
- Can include integration script examples
- Helps users understand file formats

### 5. Lowercase File Names with Hyphens

**Why:**
- Modern web/CLI convention (GitHub, npm packages)
- More readable in URLs (if docs hosted online)
- Avoids case-sensitivity issues on different filesystems
- Consistent with npm package naming conventions

**Example:**
- `GETTING_STARTED.md` → `getting-started.md`
- `GEN_ADDRESS_GUIDE.md` → `gen-address.md`

**Exception:** `README.md` - universal convention remains uppercase

### 6. Numbered Tutorial Files

**Why:**
- Clear ordering in file explorers (01, 02, 03...)
- Indicates progressive learning path
- Easy to reference ("see tutorial 3")

**Format:** `01-first-token.md` not `tutorial-1-first-token.md`
- Shorter, cleaner
- Numbering is sufficient for ordering

### 7. Archives for Historical Documents

**Why:**
- Preserves work and context
- Doesn't clutter main documentation
- Can be referenced if needed
- Clearly marked as historical (not current)

### 8. Root Directory Minimalism

**Why:**
- Industry best practice (see: typescript, next.js, react)
- Easier to navigate project
- Clear entry point (README.md)
- Essential config files easily found

**Keep in Root:**
- README.md (main entry point)
- package.json (npm configuration)
- tsconfig.json (TypeScript configuration)
- .gitignore (git configuration)
- LICENSE (if applicable)
- CHANGELOG.md (version history, if applicable)

---

## Migration Steps

### Phase 1: Preparation (No Changes Yet)

**Step 1.1: Review and Approval**
- Review this plan
- Identify any concerns or modifications
- Approve before proceeding

**Step 1.2: Create Git Branch**
```bash
git checkout -b restructure/organize-documentation
```

**Step 1.3: Backup Current State**
```bash
git add -A
git commit -m "Checkpoint before restructuring"
```

### Phase 2: Create New Directory Structure

**Step 2.1: Create Documentation Directories**
```bash
mkdir -p docs/guides/commands
mkdir -p docs/guides/workflows
mkdir -p docs/tutorials
mkdir -p docs/reference
```

**Step 2.2: Create Development Directories**
```bash
mkdir -p .dev/archives/readme-alternatives
```

**Step 2.3: Create Test Directories**
```bash
mkdir -p tests/scripts
mkdir -p tests/unit
mkdir -p tests/integration
```

**Step 2.4: Create Examples Directories**
```bash
mkdir -p examples/tokens
mkdir -p examples/scripts
touch examples/tokens/.gitkeep
touch examples/scripts/.gitkeep
```

### Phase 3: Move Documentation Files

**Step 3.1: Move Main Documentation**
```bash
# User docs
git mv GETTING_STARTED.md docs/getting-started.md
git mv GLOSSARY.md docs/glossary.md
git mv DOCUMENTATION_INDEX.md docs/README.md

# Reference docs
git mv API_REFERENCE.md docs/reference/api-reference.md
git mv TXF_IMPLEMENTATION_GUIDE.md docs/reference/txf-format.md
```

**Step 3.2: Move Command Guides**
```bash
git mv GEN_ADDRESS_GUIDE.md docs/guides/commands/gen-address.md
git mv MINT_TOKEN_GUIDE.md docs/guides/commands/mint-token.md
git mv SEND_TOKEN_GUIDE.md docs/guides/commands/send-token.md
git mv RECEIVE_TOKEN_GUIDE.md docs/guides/commands/receive-token.md
git mv VERIFY_TOKEN_GUIDE.md docs/guides/commands/verify-token.md
git mv SEND_TOKEN_QUICKREF.md docs/guides/commands/send-token-quickref.md
```

**Step 3.3: Move Workflow Guides**
```bash
git mv TRANSFER_GUIDE.md docs/guides/workflows/transfer-guide.md
git mv OFFLINE_TRANSFER_WORKFLOW.md docs/guides/workflows/offline-transfer.md
```

**Step 3.4: Move Tutorials**
```bash
git mv TUTORIALS_INDEX.md docs/tutorials/README.md
git mv TUTORIALS_QUICK_START.md docs/tutorials/quick-start.md
git mv TUTORIAL_1_FIRST_TOKEN.md docs/tutorials/01-first-token.md
git mv TUTORIAL_2_TOKEN_TRANSFERS.md docs/tutorials/02-token-transfers.md
git mv TUTORIAL_3_ADVANCED_OPERATIONS.md docs/tutorials/03-advanced-operations.md
git mv TUTORIAL_4_TOKEN_INTERNALS.md docs/tutorials/04-token-internals.md
git mv TUTORIAL_5_PRODUCTION_PRACTICES.md docs/tutorials/05-production-practices.md
```

**Step 3.5: Move Developer Docs**
```bash
git mv CLAUDE.md .dev/README.md
git mv IMPLEMENTATION_SUMMARY.md .dev/implementation-notes.md
git mv FINDINGS.md .dev/findings.md
```

**Step 3.6: Archive Historical Documents**
```bash
git mv DOCUMENTATION_ANALYSIS.md .dev/archives/documentation-analysis.md
git mv DOCUMENTATION_IMPROVEMENTS_SUMMARY.md .dev/archives/documentation-improvements.md
git mv DOCUMENTATION_TODO.md .dev/archives/documentation-todo.md
git mv TUTORIAL_DELIVERY_SUMMARY.md .dev/archives/tutorial-delivery.md
git mv TUTORIALS_SUMMARY.md .dev/archives/tutorials-summary.md
git mv README_ENHANCED.md .dev/archives/readme-alternatives/README_ENHANCED.md
git mv README_TUTORIALS.md .dev/archives/readme-alternatives/README_TUTORIALS.md
```

### Phase 4: Move Test Scripts

```bash
git mv test-address-to-predicate.js tests/scripts/test-address-to-predicate.js
git mv test-mint-style-commitment.js tests/scripts/test-mint-style-commitment.js
git mv test-token-reload.js tests/scripts/test-token-reload.js
git mv test-with-minter-secret.js tests/scripts/test-with-minter-secret.js
git mv verify-predicate-encoding.js tests/scripts/verify-predicate-encoding.js
```

### Phase 5: Handle Token Files

**Option A: Move to Examples** (if they're useful examples)
```bash
git mv *.txf examples/tokens/
```

**Option B: Delete** (if they're just test artifacts)
```bash
rm *.txf
```

**Recommendation:** Delete them - they appear to be test artifacts, not example files.

### Phase 6: Update References

**Step 6.1: Update README.md**
- Update all documentation links to new paths
- Example: `[Getting Started](GETTING_STARTED.md)` → `[Getting Started](docs/getting-started.md)`

**Step 6.2: Update .dev/README.md (formerly CLAUDE.md)**
- Update file paths in developer instructions
- Update references to documentation locations

**Step 6.3: Update All Documentation Files**

Update links in documentation files to reflect new paths:

**In `docs/README.md`:**
```markdown
# Before
[GETTING_STARTED.md](GETTING_STARTED.md)
[GEN_ADDRESS_GUIDE.md](GEN_ADDRESS_GUIDE.md)

# After
[Getting Started](getting-started.md)
[gen-address Command](guides/commands/gen-address.md)
```

**In `docs/getting-started.md`:**
```markdown
# Before
See [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md)

# After
See [Mint Token Guide](guides/commands/mint-token.md)
```

**Strategy:** Use a script or search-replace to update all markdown links systematically.

**Step 6.4: Update .gitignore**
```bash
# Add to .gitignore if not already present
examples/tokens/*.txf
*.txf

# Update path references if any (claude/ already ignored)
```

**Step 6.5: Create/Update .dev/.gitignore**
```bash
# Ensure .dev/archives/ is tracked in git (not ignored)
# These are part of project history
```

### Phase 7: Update Package.json (If Needed)

Check if package.json references any documentation paths:
- Update any script descriptions
- Update homepage/documentation URLs

### Phase 8: Verification

**Step 8.1: Check All Links**
```bash
# Run link checker on all markdown files
# Example: markdown-link-check or custom script
```

**Step 8.2: Test Build**
```bash
npm run build
```

**Step 8.3: Test Commands**
```bash
npm run gen-address
npm run mint-token -- --help
# etc.
```

**Step 8.4: Review Git Status**
```bash
git status
git diff --stat
```

### Phase 9: Commit and Merge

**Step 9.1: Commit Changes**
```bash
git add -A
git commit -m "Reorganize project structure according to TypeScript/Node.js CLI best practices

- Move 30+ markdown files from root to organized subdirectories
- Separate user docs (docs/) from developer docs (.dev/)
- Organize documentation by type: guides, tutorials, reference
- Move test scripts to tests/scripts/
- Archive historical analysis documents
- Update all internal documentation links
- Clean up root directory (keep only essential files)

BREAKING CHANGES: Documentation file paths have changed. Update any external links.

See PROJECT_REORGANIZATION_PLAN.md for complete details."
```

**Step 9.2: Push Branch**
```bash
git push -u origin restructure/organize-documentation
```

**Step 9.3: Create Pull Request**
- Review changes in PR
- Update PR description with summary
- Merge after approval

---

## Files Requiring Link Updates

### High Priority (Many Links)

1. **README.md** - Main entry point, links to all guides
2. **docs/README.md** (DOCUMENTATION_INDEX.md) - Navigation hub, links everywhere
3. **docs/getting-started.md** - Links to multiple guides
4. **docs/tutorials/README.md** - Links to all tutorials
5. **.dev/README.md** (CLAUDE.md) - Developer guide with file references

### Medium Priority (Some Links)

6. All command guides in `docs/guides/commands/` - Cross-reference each other
7. All tutorial files in `docs/tutorials/` - Sequential links
8. Workflow guides in `docs/guides/workflows/` - Reference commands

### Low Priority (Few Links)

9. Reference docs in `docs/reference/` - Mostly self-contained
10. Archived documents in `.dev/archives/` - Historical, less critical

---

## Link Update Pattern Reference

### Update README.md Links

```markdown
# BEFORE
- [Getting Started Guide](GETTING_STARTED.md)
- [API Reference](API_REFERENCE.md)
- [Documentation Index](DOCUMENTATION_INDEX.md)
- [Tutorial Series](TUTORIALS_INDEX.md)
- [Glossary](GLOSSARY.md)

# AFTER
- [Getting Started Guide](docs/getting-started.md)
- [API Reference](docs/reference/api-reference.md)
- [Documentation Index](docs/README.md)
- [Tutorial Series](docs/tutorials/README.md)
- [Glossary](docs/glossary.md)
```

### Update Command Table in README.md

```markdown
# BEFORE
| `mint-token` | Create new tokens | [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md) |
| `verify-token` | Verify tokens | [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md) |

# AFTER
| `mint-token` | Create new tokens | [mint-token guide](docs/guides/commands/mint-token.md) |
| `verify-token` | Verify tokens | [verify-token guide](docs/guides/commands/verify-token.md) |
```

### Update Cross-References in Guides

```markdown
# BEFORE (in mint-token.md)
See [GEN_ADDRESS_GUIDE.md](GEN_ADDRESS_GUIDE.md) for address generation.
See [GLOSSARY.md](GLOSSARY.md#secret) for secret definition.

# AFTER (in docs/guides/commands/mint-token.md)
See [gen-address guide](gen-address.md) for address generation.
See [Glossary](../../glossary.md#secret) for secret definition.
```

### Update Tutorial Links

```markdown
# BEFORE (in TUTORIAL_1_FIRST_TOKEN.md)
Next: [TUTORIAL_2_TOKEN_TRANSFERS.md](TUTORIAL_2_TOKEN_TRANSFERS.md)
See: [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md)

# AFTER (in docs/tutorials/01-first-token.md)
Next: [Tutorial 2: Token Transfers](02-token-transfers.md)
See: [Mint Token Guide](../guides/commands/mint-token.md)
```

### Update Developer Documentation

```markdown
# BEFORE (in CLAUDE.md)
See MINT_TOKEN_GUIDE.md for command details.
Reference TXF_IMPLEMENTATION_GUIDE.md for format spec.

# AFTER (in .dev/README.md)
See docs/guides/commands/mint-token.md for command details.
Reference docs/reference/txf-format.md for format spec.
```

---

## Automated Link Update Strategy

### Option 1: Manual Search and Replace

Use editor's find-and-replace with regex:

**Pattern:**
```regex
\[([^\]]+)\]\(([A-Z_]+\.md)(#[^\)]+)?\)
```

**Strategy:**
- Create mapping table of old→new paths
- Process each file individually
- Verify links after each file

### Option 2: Script-Based Replacement

Create a Node.js script to update all links:

```javascript
// scripts/update-doc-links.js
const fs = require('fs');
const path = require('path');

const linkMapping = {
  'GETTING_STARTED.md': 'docs/getting-started.md',
  'GLOSSARY.md': 'docs/glossary.md',
  'GEN_ADDRESS_GUIDE.md': 'docs/guides/commands/gen-address.md',
  // ... complete mapping
};

function updateLinks(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  for (const [oldPath, newPath] of Object.entries(linkMapping)) {
    const regex = new RegExp(`\\(${oldPath}(#[^)]+)?\\)`, 'g');
    content = content.replace(regex, (match, hash) => {
      // Calculate relative path from filePath to newPath
      const relPath = calculateRelativePath(filePath, newPath);
      return `(${relPath}${hash || ''})`;
    });
  }

  fs.writeFileSync(filePath, content);
}
```

### Option 3: Find and Manual Review

```bash
# Find all markdown links
grep -r '\[.*\](.*\.md' docs/ README.md .dev/

# Review each and update manually
```

**Recommendation:** Use Option 1 (manual) with careful verification, as the number of files is manageable (~30 files) and ensures accuracy.

---

## Potential Issues and Solutions

### Issue 1: Broken Links After Migration

**Problem:** Documentation links break if not updated correctly

**Solution:**
- Create comprehensive mapping table
- Update links systematically
- Test links with markdown link checker
- Consider using absolute paths from repo root

**Prevention:**
```bash
# Run link checker before and after
npm install -g markdown-link-check
markdown-link-check README.md
markdown-link-check docs/**/*.md
```

### Issue 2: GitHub Wiki or External Links

**Problem:** External documentation or wikis may link to old paths

**Solution:**
- Update GitHub wiki (if exists)
- Update any external documentation references
- Add redirect note in commit message
- Consider GitHub Pages redirects (if applicable)

### Issue 3: Git History Navigation

**Problem:** Git blame/history shows files in old locations

**Solution:**
- Git handles file moves automatically
- Use `git log --follow <file>` to trace history
- Document move in commit message
- No action needed - git tracks moves

### Issue 4: Open Pull Requests

**Problem:** Existing PRs may reference old file paths

**Solution:**
- Notify contributors of restructuring
- Update open PRs after merge
- Document path changes in PR description

### Issue 5: npm Package README

**Problem:** If published to npm, package README may show broken links

**Solution:**
- Update package.json homepage/repository URLs
- Test README rendering on npmjs.com
- Consider keeping some docs in root (or using absolute URLs)

### Issue 6: Claude Code (AI Assistant) Context

**Problem:** .dev/README.md (CLAUDE.md) has specific formatting for Claude Code

**Solution:**
- Maintain CLAUDE.md in root AND .dev/README.md
- Or: Symlink from root to .dev/README.md
- Or: Update .claude/settings.local.json to point to new location

**Recommendation:** Keep CLAUDE.md in root (it's developer-facing but special)

**Revised Decision:**
- Keep `CLAUDE.md` in root (don't move to .dev/)
- It's a special case for AI tooling
- Add note in .dev/README.md pointing to CLAUDE.md

### Issue 7: Build Process

**Problem:** Build process may reference file paths

**Solution:**
- Check tsconfig.json paths
- Check package.json scripts
- Test build after restructure
- Update any hard-coded paths

**Analysis:** No changes needed - build only touches src/ and dist/

### Issue 8: Case Sensitivity

**Problem:** Git on case-insensitive filesystems (macOS, Windows) may not detect case-only renames

**Solution:**
```bash
# Use two-step rename for case-only changes
git mv GETTING_STARTED.md getting_started_temp.md
git mv getting_started_temp.md getting-started.md
```

**Note:** Our renames also change directory, so this shouldn't be an issue.

---

## CI/CD Implications

### GitHub Actions

**Check:**
- Any workflows that reference documentation paths
- Link checking actions
- Documentation deployment scripts

**Update:**
- Update paths in workflow files
- Update any documentation build scripts

### Documentation Hosting

**If using GitHub Pages:**
- Update Jekyll/Docusaurus configuration
- Update navigation structure
- Update base paths

**If using external docs site:**
- Update documentation sync scripts
- Update site navigation
- Verify builds after restructure

---

## Post-Migration Checklist

- [ ] All documentation files moved to new locations
- [ ] Test scripts moved to tests/scripts/
- [ ] Historical documents archived to .dev/archives/
- [ ] Root directory clean (only essential files)
- [ ] README.md links updated and verified
- [ ] docs/README.md navigation updated
- [ ] All tutorial links updated (sequential navigation)
- [ ] All command guide cross-references updated
- [ ] .dev/README.md (CLAUDE.md) paths updated
- [ ] CLAUDE.md decision made (keep in root or move)
- [ ] .gitignore updated (if needed)
- [ ] Token files cleaned up (deleted or archived)
- [ ] Build process tested (npm run build)
- [ ] Commands tested (gen-address, mint-token, etc.)
- [ ] Link checker run on all markdown files
- [ ] Git commit message includes BREAKING CHANGES note
- [ ] PR created with summary and review
- [ ] Contributors notified of restructure
- [ ] External documentation updated (if applicable)
- [ ] Merged to main branch

---

## Alternative Approaches Considered

### Alternative 1: Keep All Docs in Root with Prefixes

**Structure:**
```
docs-getting-started.md
docs-guide-gen-address.md
docs-tutorial-01-first-token.md
```

**Rejected Because:**
- Still cluttered root directory
- Harder to navigate in file explorer
- Not standard CLI convention
- No logical grouping

### Alternative 2: Single `docs/` Flat Directory

**Structure:**
```
docs/
  getting-started.md
  gen-address.md
  mint-token.md
  tutorial-01-first-token.md
  tutorial-02-token-transfers.md
  # ... all docs in one folder
```

**Rejected Because:**
- 30+ files in one directory is still cluttered
- No organization by type
- Hard to distinguish guides from tutorials
- Doesn't scale well

### Alternative 3: Conventional `docs/` with Type Prefixes

**Structure:**
```
docs/
  guide-gen-address.md
  guide-mint-token.md
  tutorial-01-first-token.md
  tutorial-02-token-transfers.md
  workflow-transfer-guide.md
  reference-api.md
```

**Rejected Because:**
- Subdirectories are clearer
- Prefixes are redundant with subdirectories
- Harder to navigate
- Less conventional

### Alternative 4: Docs Hosted Separately (Docusaurus/GitBook)

**Structure:**
```
# Separate docs repository
unicity-cli/        # Code only
unicity-cli-docs/   # Documentation only
```

**Rejected Because:**
- Over-engineering for current project size
- Harder to keep docs in sync with code
- More maintenance overhead
- Documentation should live with code

---

## Recommendation Summary

### Adopt Proposed Structure (docs/, .dev/, tests/, examples/)

**Reasons:**
1. ✅ Follows TypeScript/Node.js CLI conventions
2. ✅ Separates user docs from developer docs
3. ✅ Organizes by document type and user journey
4. ✅ Scales well for future growth
5. ✅ Clean root directory (best practice)
6. ✅ Clear navigation hierarchy
7. ✅ Improves documentation discoverability
8. ✅ Maintains all content (archives historical docs)
9. ✅ Zero breaking changes to functionality
10. ✅ Relatively easy migration (mostly git mv)

**Trade-offs:**
- ⚠️ Requires updating ~100+ documentation links
- ⚠️ One-time migration effort (2-3 hours)
- ⚠️ External links will break (need BREAKING CHANGES note)

**Mitigation:**
- Use systematic link update process
- Test thoroughly with link checker
- Document changes in commit message
- Create PR for review before merge

---

## Final Recommendation

**Proceed with proposed reorganization:**

1. Create feature branch
2. Create new directory structure
3. Move files with `git mv` (preserves history)
4. Update all documentation links systematically
5. Test build and commands
6. Run link checker
7. Commit with detailed message
8. Create PR for review
9. Merge after approval

**Estimated Effort:**
- Directory creation: 10 minutes
- File moves: 20 minutes
- Link updates: 90 minutes
- Testing and verification: 30 minutes
- **Total: ~2.5 hours**

**Benefits:**
- Professional project structure
- Improved documentation discoverability
- Better maintainability
- Follows industry best practices
- Scales for future growth

---

## Next Steps

1. **Review this plan** - Identify any concerns or modifications
2. **Approve or modify** - Make adjustments if needed
3. **Execute migration** - Follow step-by-step migration guide
4. **Verify and test** - Ensure everything works correctly
5. **Commit and merge** - Complete restructure

---

## Questions or Concerns?

Before proceeding with migration, consider:

1. Are there any external systems that reference current paths?
2. Are there open PRs that would be affected?
3. Is this package published to npm (affects README rendering)?
4. Are there any build/CI scripts that reference file paths?
5. Should CLAUDE.md stay in root or move to .dev/?

**Please review and approve before proceeding with migration.**

---

**Document Status:** PROPOSAL - Awaiting Approval
**Created:** 2025-11-03
**Author:** Claude Code (Software Architecture Expert)
