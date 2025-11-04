# Git Hooks Configuration

Automated quality checks integrated into the Git workflow for the Unicity CLI project.

## Overview

Git hooks are scripts that run automatically at key points in the Git workflow. This project uses hooks to enforce code quality standards and prevent common mistakes.

## Installation

### Automatic Setup

The hooks are automatically configured during project setup. Git will look for hooks in the `.githooks` directory instead of the default `.git/hooks` directory.

### Manual Setup

If hooks are not automatically configured, set up the hooks path:

```bash
# Configure Git to use custom hooks directory
git config core.hooksPath .githooks

# Verify configuration
git config core.hooksPath
# Expected output: .githooks

# Make hooks executable
chmod +x .githooks/*
```

### Global Setup (Optional)

To use these hooks for all repositories:

```bash
# Not recommended, but possible
git config --global core.hooksPath ~/.githooks
cp -r .githooks/* ~/.githooks/
```

## Available Hooks

### Pre-commit Hook (`.githooks/pre-commit`)

Runs before creating a commit. Prevents committing code with issues.

**Checks Performed**:

1. **Sensitive Files Detection**
   - Prevents accidental commit of `.env` files
   - Blocks private keys and credentials
   - Checks for sensitive patterns

2. **Code Linting**
   - Runs ESLint on TypeScript/JavaScript files
   - Validates code style
   - Checks for syntax errors

3. **Build Verification**
   - Verifies TypeScript compilation
   - Checks dist/ directory is up-to-date
   - Ensures dependencies are valid

4. **Smoke Tests**
   - Runs quick unit tests
   - Validates critical functionality
   - Fast subset of full test suite

**Usage**:

```bash
# Hooks run automatically on commit
git commit -m "Fix bug"

# If all checks pass, commit is created
# If any check fails, commit is prevented

# Force commit without hooks (not recommended)
git commit --no-verify -m "Fix bug"

# Or set environment variable
PRE_COMMIT_SKIP=1 git commit -m "Fix bug"
```

**Example Output**:

```
╔════════════════════════════════════════════════════════════════╗
║           Unicity CLI - Pre-commit Quality Checks              ║
╚════════════════════════════════════════════════════════════════╝

INFO: Checking for sensitive files...
✓ No sensitive files detected

INFO: Checking code style...
✓ Code style checks passed

INFO: Verifying build...
✓ TypeScript compilation verified

INFO: Running quick smoke tests...
✓ Unit tests passed

╔════════════════════════════════════════════════════════════════╗
║              Pre-commit checks PASSED - Ready to commit!        ║
╚════════════════════════════════════════════════════════════════╝
```

## Hook Configuration

### Disable Specific Checks

Edit `.githooks/pre-commit` to disable checks:

```bash
# Example: Disable lint check
# Comment out or remove this line:
# if ! check_lint; then

# Example: Disable smoke tests
# Comment out or remove this line:
# if ! run_smoke_tests; then
```

### Customize Timeout

Adjust test timeout in `.githooks/pre-commit`:

```bash
# Default: 30 seconds
# Increase for slower systems:
TIMEOUT=60

# In run_smoke_tests function:
timeout "$TIMEOUT" bats ...
```

### Skip for Specific Commits

```bash
# For single commit
PRE_COMMIT_SKIP=1 git commit -m "Emergency fix"

# For series of commits
export PRE_COMMIT_SKIP=1
git commit -m "Fix 1"
git commit -m "Fix 2"
git commit -m "Fix 3"
unset PRE_COMMIT_SKIP
```

## Troubleshooting

### Hooks Not Running

1. **Verify hook path is configured**:
   ```bash
   git config core.hooksPath
   # Should output: .githooks
   ```

2. **Make hooks executable**:
   ```bash
   chmod +x .githooks/*
   ```

3. **Check hook file exists**:
   ```bash
   ls -la .githooks/pre-commit
   # Should show: -rwxr-xr-x
   ```

### Hook Execution Fails

1. **Check hook directly**:
   ```bash
   ./.githooks/pre-commit
   # Shows detailed error output
   ```

2. **Enable debug mode**:
   ```bash
   bash -x ./.githooks/pre-commit
   ```

3. **Check dependencies**:
   ```bash
   which bats npm eslint jq
   # All should be found
   ```

### Linting Fails

1. **Fix linting errors**:
   ```bash
   npm run lint -- --fix
   # Auto-fixes where possible
   ```

2. **Stage fixed files**:
   ```bash
   git add .
   git commit -m "Fix linting issues"
   ```

### Tests Fail

1. **Run tests locally**:
   ```bash
   npm run test:unit
   npm run test:functional
   ```

2. **Build CLI**:
   ```bash
   npm run build
   ```

3. **Install dependencies**:
   ```bash
   npm ci
   ```

### Aggregator Not Available

Some tests may be skipped if aggregator is not available. Start it:

```bash
# Docker
docker run -p 3000:3000 unicity/aggregator:latest

# Or skip aggregator check
UNICITY_TEST_SKIP_EXTERNAL=1 git commit -m "message"
```

## Best Practices

### Commit Frequently

- Make small, focused commits
- Hooks run faster with minimal changes
- Easier to debug issues

### Keep Changes Minimal

- Don't commit unnecessary files
- Clean up before committing
- Remove debug code

### Use Proper Commit Messages

- Clear, descriptive messages
- Reference issues when applicable
- Follow commit message conventions

### Understand Hook Failures

- Read error messages carefully
- Fix actual issues, not just bypass hooks
- Learn from feedback

## Development Workflow

### Typical Workflow

1. **Make changes**:
   ```bash
   # Edit files
   vim src/cli.ts
   ```

2. **Stage changes**:
   ```bash
   git add src/cli.ts
   ```

3. **Commit changes** (hooks run automatically):
   ```bash
   git commit -m "Add feature X"
   # Pre-commit hooks run automatically
   ```

4. **If hooks fail**:
   ```bash
   # Fix issues shown in output
   npm run lint -- --fix  # Fix linting
   npm run build          # Rebuild
   npm run test:unit      # Run tests

   # Stage fixes
   git add .

   # Commit again (hooks run again)
   git commit -m "Add feature X"
   ```

5. **If hooks pass**:
   ```bash
   # Commit is created
   # Ready to push
   git push origin feature-branch
   ```

### Pre-commit Checklist

Before committing, ensure:

- [ ] Code changes are intentional
- [ ] No debug code left behind
- [ ] No sensitive files included
- [ ] Tests pass locally
- [ ] Code is properly formatted
- [ ] Build succeeds

## Performance

### Typical Hook Execution Time

- Sensitive files check: <1 second
- Linting check: 3-5 seconds
- Build verification: 2-3 seconds
- Smoke tests: 15-30 seconds

**Total**: 20-40 seconds (depends on system and changes)

### Optimizing Speed

1. **Make smaller commits**:
   - Less code to check
   - Faster linting and testing

2. **Skip expensive checks when safe**:
   ```bash
   PRE_COMMIT_SKIP=1 git commit -m "message"
   ```

3. **Run tests in parallel** (if supported):
   - PARALLEL=true in hook configuration

4. **Use SSD**:
   - Faster file I/O
   - Quicker test execution

## Integration with CI/CD

- **Local hooks** (.githooks): Pre-commit validation
- **GitHub Actions** (.github/workflows): Full test suite
- **Pre-push validation**: Could be added to prevent pushing failed tests

Flow:
```
Local Changes
    ↓
Pre-commit Hook (Quick checks)
    ↓
Git Commit
    ↓
Git Push
    ↓
GitHub Actions (Full validation)
```

## Advanced Configuration

### Custom Hook Scripts

Add custom hooks by creating new files in `.githooks`:

```bash
# Example: prepare-commit-msg hook
cat > .githooks/prepare-commit-msg << 'EOF'
#!/usr/bin/env bash
# Auto-prepend branch name to commit message
EOF

chmod +x .githooks/prepare-commit-msg
```

### Conditional Checks

Run different checks based on branch or file changes:

```bash
# Skip checks on main branch
if [[ $(git rev-parse --abbrev-ref HEAD) == "main" ]]; then
    # Different checks for main
fi

# Skip checks for documentation changes
if git diff --cached --name-only | grep -q "\.md$"; then
    # Handle doc-only changes
fi
```

## Disabling Hooks (Not Recommended)

To permanently disable hooks:

```bash
# Not recommended! Only if absolutely necessary
git config core.hooksPath /dev/null

# To re-enable
git config core.hooksPath .githooks
```

Or remove hook files (will lose version control):

```bash
# Not recommended
rm -rf .githooks
```

## Contributing Hook Improvements

To improve or add hooks:

1. **Test changes locally**:
   ```bash
   # Manually test your hook
   bash -x .githooks/pre-commit
   ```

2. **Create test cases**:
   ```bash
   # Add tests for hook behavior
   ```

3. **Document changes**:
   ```bash
   # Update this README
   ```

4. **Submit PR with improvements**

## References

- [Git Hooks Documentation](https://git-scm.com/docs/githooks)
- [Husky (Node.js hook manager)](https://typicode.github.io/husky/)
- [Pre-commit Framework](https://pre-commit.com/)

## Support

For issues with hooks:

1. Check this README
2. Run hook manually: `./.githooks/pre-commit`
3. Check git configuration: `git config -l`
4. Review hook error messages carefully
5. Open issue with error output

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainer**: Unicity Network
