# Usage Examples for Unicity Expert Agents

This document provides practical examples of how to use the Unicity Expert Agents in various scenarios.

## Table of Contents

- [AI Assistant Integration](#ai-assistant-integration)
- [CLI Usage Examples](#cli-usage-examples)
- [Programmatic Access](#programmatic-access)
- [Integration Examples](#integration-examples)
- [Common Workflows](#common-workflows)

---

## AI Assistant Integration

### Example 1: Claude Code Integration

Add to your project's `CLAUDE.md` file:

```markdown
# CLAUDE.md

## Unicity Network Expertise

This project integrates with Unicity Network. When answering Unicity-related questions,
load the appropriate expert profile from `.claude-agents/`:

### Architecture Questions
Read: `.claude-agents/unicity-experts/unicity-architect.md`
Use this for: System design, component interactions, architectural patterns

### Consensus Questions
Read: `.claude-agents/unicity-experts/consensus-expert.md`
Use this for: PoW/BFT setup, mining, validator operations

### Aggregator Questions
Read: `.claude-agents/unicity-experts/proof-aggregator-expert.md`
Use this for: API integration, deployment, operations

### Development Questions
Read: `.claude-agents/unicity-experts/unicity-developers.md`
Use this for: SDK usage, code examples, best practices
```

### Example 2: Cursor IDE Integration

Add to `.cursorrules`:

```
# Unicity Network Expert Knowledge

When the user asks about Unicity Network:

1. Identify the topic area:
   - Architecture/Design → Load unicity-architect.md
   - Mining/Consensus → Load consensus-expert.md
   - API/Aggregator → Load proof-aggregator-expert.md
   - Development/SDKs → Load unicity-developers.md

2. Reference research docs in unicity-research/ for deeper details

3. Provide code examples from the SDK research reports

4. Always cite the expert profile you're using
```

---

## CLI Usage Examples

### Example 3: Quick Reference Lookup

```bash
# Find information about state transitions
grep -r "StateTransition" .claude-agents/unicity-experts/

# Search for Java SDK examples
grep -A 10 "Java SDK" .claude-agents/unicity-experts/unicity-developers.md

# Find aggregator API endpoints
grep -r "JSON-RPC" .claude-agents/unicity-experts/proof-aggregator-expert.md
```

### Example 4: View Specific Expert Profile

```bash
# Read the architecture expert profile
less .claude-agents/unicity-experts/unicity-architect.md

# Read consensus expert with syntax highlighting (if you have bat)
bat .claude-agents/unicity-experts/consensus-expert.md

# Extract just the key knowledge sections
awk '/## Key Knowledge/,/## Use Cases/' \
  .claude-agents/unicity-experts/unicity-architect.md
```

### Example 5: Search Research Documentation

```bash
# Find performance metrics
grep -r "throughput\|latency\|performance" .claude-agents/unicity-research/

# Search for TypeScript examples
grep -A 20 "TypeScript" .claude-agents/unicity-research/UNICITY_SDK_RESEARCH_REPORT.md

# Find deployment instructions
grep -r "Docker\|Kubernetes" .claude-agents/unicity-research/
```

---

## Programmatic Access

### Example 6: Python Script to Load Expert Profiles

```python
#!/usr/bin/env python3
"""
Load Unicity expert profiles programmatically
"""

import os
from pathlib import Path

class UnicityExpertLoader:
    def __init__(self, base_path=".claude-agents"):
        self.base_path = Path(base_path)
        self.experts = {
            'architect': self.base_path / 'unicity-experts' / 'unicity-architect.md',
            'consensus': self.base_path / 'unicity-experts' / 'consensus-expert.md',
            'aggregator': self.base_path / 'unicity-experts' / 'proof-aggregator-expert.md',
            'developer': self.base_path / 'unicity-experts' / 'unicity-developers.md'
        }

    def load_expert(self, expert_type):
        """Load an expert profile by type."""
        if expert_type not in self.experts:
            raise ValueError(f"Unknown expert type: {expert_type}")

        with open(self.experts[expert_type], 'r', encoding='utf-8') as f:
            return f.read()

    def search_expert(self, expert_type, query):
        """Search for a query within an expert profile."""
        content = self.load_expert(expert_type)
        lines = content.split('\n')

        results = []
        for i, line in enumerate(lines):
            if query.lower() in line.lower():
                # Include context (3 lines before and after)
                start = max(0, i - 3)
                end = min(len(lines), i + 4)
                results.append({
                    'line_number': i + 1,
                    'line': line,
                    'context': '\n'.join(lines[start:end])
                })

        return results

# Usage
loader = UnicityExpertLoader()

# Load architecture expert
arch_content = loader.load_expert('architect')
print(f"Loaded {len(arch_content)} characters of architecture expertise")

# Search for specific topics
results = loader.search_expert('developer', 'TypeScript')
print(f"Found {len(results)} mentions of TypeScript")
for result in results[:3]:  # Show first 3
    print(f"\nLine {result['line_number']}: {result['line']}")
```

### Example 7: Node.js Script to Load Expert Profiles

```javascript
#!/usr/bin/env node
/**
 * Load Unicity expert profiles programmatically
 */

const fs = require('fs');
const path = require('path');

class UnicityExpertLoader {
  constructor(basePath = '.claude-agents') {
    this.basePath = basePath;
    this.experts = {
      architect: path.join(basePath, 'unicity-experts', 'unicity-architect.md'),
      consensus: path.join(basePath, 'unicity-experts', 'consensus-expert.md'),
      aggregator: path.join(basePath, 'unicity-experts', 'proof-aggregator-expert.md'),
      developer: path.join(basePath, 'unicity-experts', 'unicity-developers.md')
    };
  }

  loadExpert(expertType) {
    if (!(expertType in this.experts)) {
      throw new Error(`Unknown expert type: ${expertType}`);
    }
    return fs.readFileSync(this.experts[expertType], 'utf-8');
  }

  searchExpert(expertType, query) {
    const content = this.loadExpert(expertType);
    const lines = content.split('\n');

    const results = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        const start = Math.max(0, i - 3);
        const end = Math.min(lines.length, i + 4);
        results.push({
          lineNumber: i + 1,
          line: line,
          context: lines.slice(start, end).join('\n')
        });
      }
    });

    return results;
  }

  extractCodeExamples(expertType, language) {
    const content = this.loadExpert(expertType);
    const regex = new RegExp('```' + language + '\\n([\\s\\S]*?)\\n```', 'g');
    const examples = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      examples.push(match[1]);
    }

    return examples;
  }
}

// Usage
const loader = new UnicityExpertLoader();

// Load developer expert
const devContent = loader.loadExpert('developer');
console.log(`Loaded ${devContent.length} characters of developer expertise`);

// Extract TypeScript examples
const tsExamples = loader.extractCodeExamples('developer', 'typescript');
console.log(`Found ${tsExamples.length} TypeScript examples`);

// Search for specific API
const results = loader.searchExpert('aggregator', 'RegisterStateTransition');
console.log(`Found ${results.length} mentions of RegisterStateTransition API`);
```

---

## Integration Examples

### Example 8: Express.js API with Expert Profiles

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Expert profiles directory
const expertsDir = path.join(__dirname, '.claude-agents', 'unicity-experts');

// API endpoint to get expert profile
app.get('/api/expert/:type', (req, res) => {
  const { type } = req.params;
  const expertFile = path.join(expertsDir, `${type}.md`);

  if (!fs.existsSync(expertFile)) {
    return res.status(404).json({ error: 'Expert profile not found' });
  }

  const content = fs.readFileSync(expertFile, 'utf-8');
  res.json({
    expert: type,
    content: content,
    size: content.length
  });
});

// API endpoint to search experts
app.get('/api/search', (req, res) => {
  const { query, expert } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  const files = expert
    ? [path.join(expertsDir, `${expert}.md`)]
    : fs.readdirSync(expertsDir).map(f => path.join(expertsDir, f));

  const results = [];
  files.forEach(file => {
    if (!fs.existsSync(file)) return;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          file: path.basename(file),
          lineNumber: i + 1,
          line: line.trim()
        });
      }
    });
  });

  res.json({ query, results, count: results.length });
});

app.listen(port, () => {
  console.log(`Unicity Expert API listening at http://localhost:${port}`);
});
```

### Example 9: FastAPI (Python) with Expert Profiles

```python
from fastapi import FastAPI, HTTPException, Query
from pathlib import Path
from typing import Optional
import re

app = FastAPI(title="Unicity Expert API")

EXPERTS_DIR = Path(".claude-agents/unicity-experts")
RESEARCH_DIR = Path(".claude-agents/unicity-research")

@app.get("/api/expert/{expert_type}")
async def get_expert(expert_type: str):
    """Get an expert profile by type."""
    expert_file = EXPERTS_DIR / f"{expert_type}.md"

    if not expert_file.exists():
        raise HTTPException(status_code=404, detail="Expert profile not found")

    content = expert_file.read_text(encoding='utf-8')

    return {
        "expert": expert_type,
        "content": content,
        "size": len(content)
    }

@app.get("/api/search")
async def search_experts(
    query: str = Query(..., description="Search query"),
    expert: Optional[str] = Query(None, description="Specific expert to search")
):
    """Search across expert profiles."""

    if expert:
        files = [EXPERTS_DIR / f"{expert}.md"]
    else:
        files = list(EXPERTS_DIR.glob("*.md"))

    results = []
    for file in files:
        if not file.exists():
            continue

        content = file.read_text(encoding='utf-8')
        lines = content.split('\n')

        for i, line in enumerate(lines):
            if query.lower() in line.lower():
                results.append({
                    "file": file.name,
                    "line_number": i + 1,
                    "line": line.strip()
                })

    return {
        "query": query,
        "results": results,
        "count": len(results)
    }

@app.get("/api/examples/{language}")
async def get_code_examples(language: str):
    """Extract code examples for a specific language."""

    research_file = RESEARCH_DIR / "UNICITY_SDK_RESEARCH_REPORT.md"

    if not research_file.exists():
        raise HTTPException(status_code=404, detail="SDK research not found")

    content = research_file.read_text(encoding='utf-8')
    pattern = rf'```{language}\n(.*?)```'
    examples = re.findall(pattern, content, re.DOTALL)

    return {
        "language": language,
        "examples": examples,
        "count": len(examples)
    }
```

---

## Common Workflows

### Example 10: Getting Started with Unicity Development

```bash
# Step 1: Install expert agents
git clone https://github.com/unicitynetwork/unicity-expert-agents.git .claude-agents

# Step 2: Learn the architecture
less .claude-agents/unicity-experts/unicity-architect.md

# Step 3: Choose your SDK
grep -A 20 "TypeScript\|Java\|Rust" .claude-agents/unicity-experts/unicity-developers.md

# Step 4: Find code examples for your language
grep -A 30 "### TypeScript SDK" \
  .claude-agents/unicity-research/UNICITY_SDK_RESEARCH_REPORT.md

# Step 5: Learn about the aggregator API
grep -A 50 "RegisterStateTransition" \
  .claude-agents/unicity-experts/proof-aggregator-expert.md
```

### Example 11: Setting Up Mining/Validator

```bash
# Learn about consensus mechanisms
less .claude-agents/unicity-experts/consensus-expert.md

# Find PoW mining setup instructions
grep -A 30 "Mining Setup" \
  .claude-agents/unicity-research/CONSENSUS_IMPLEMENTATION_GUIDE.md

# Find BFT validator setup
grep -A 30 "Validator Setup" \
  .claude-agents/unicity-research/CONSENSUS_IMPLEMENTATION_GUIDE.md

# Get quick reference for configuration
cat .claude-agents/unicity-research/CONSENSUS_QUICK_REFERENCE.md
```

### Example 12: Deploying an Aggregator

```bash
# Read aggregator expert profile
less .claude-agents/unicity-experts/proof-aggregator-expert.md

# Find Docker deployment instructions
grep -A 50 "Docker Compose" \
  .claude-agents/unicity-research/AGGREGATOR_RESEARCH_SUMMARY.md

# Find Kubernetes manifests
grep -A 100 "Kubernetes" \
  .claude-agents/unicity-experts/proof-aggregator-expert.md

# Learn about monitoring
grep -A 30 "Prometheus\|Grafana" \
  .claude-agents/unicity-experts/proof-aggregator-expert.md
```

---

## Tips and Best Practices

### Tip 1: Use grep with Context

```bash
# Show 5 lines of context before and after matches
grep -C 5 "search term" .claude-agents/unicity-experts/*.md

# Show only the matched file names
grep -l "search term" .claude-agents/unicity-experts/*.md

# Case-insensitive search with line numbers
grep -in "search term" .claude-agents/unicity-experts/*.md
```

### Tip 2: Extract Specific Sections

```bash
# Extract "Key Knowledge" section from architect profile
sed -n '/## Key Knowledge/,/## Use Cases/p' \
  .claude-agents/unicity-experts/unicity-architect.md

# Get all code examples
grep -Pzo '```(\w+)\n(.*?)\n```' \
  .claude-agents/unicity-experts/unicity-developers.md
```

### Tip 3: Create Shortcuts

Add to your `.bashrc` or `.zshrc`:

```bash
# Alias for quick expert lookup
alias uex-arch='cat .claude-agents/unicity-experts/unicity-architect.md'
alias uex-consensus='cat .claude-agents/unicity-experts/consensus-expert.md'
alias uex-agg='cat .claude-agents/unicity-experts/proof-aggregator-expert.md'
alias uex-dev='cat .claude-agents/unicity-experts/unicity-developers.md'

# Function to search all experts
uex-search() {
  grep -r "$1" .claude-agents/unicity-experts/
}
```

---

## Troubleshooting

### Issue: Expert profiles not found

```bash
# Verify installation
ls -la .claude-agents/unicity-experts/

# If empty, reinstall
git clone https://github.com/unicitynetwork/unicity-expert-agents.git .claude-agents
```

### Issue: Cannot read files

```bash
# Check permissions
chmod -R 644 .claude-agents/**/*.md

# Check file encoding
file -i .claude-agents/unicity-experts/*.md
```

---

For more examples and use cases, see the [README.md](README.md) and individual expert profiles.
