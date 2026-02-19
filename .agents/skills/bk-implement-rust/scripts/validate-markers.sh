#!/bin/bash
# bk-implement-rust marker validation guardrail
# Validates traceability markers in modified files
# Usage: validate-markers.sh <file1> <file2> ...
# Exit codes: 0=pass, 1=warnings, 2=errors

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

# Load configuration from skill references
source "$SKILL_DIR/references/marker-config.conf"

# Counters
WARNINGS=0
ERRORS=0

# Colors (disable if not TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  GREEN='\033[0;32m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED='' YELLOW='' GREEN='' BLUE='' NC=''
fi

echo "Marker Validation"
echo "================="
echo ""

# Function: Check if marker is a known placeholder
is_known_placeholder() {
  local marker="$1"
  for placeholder in "${KNOWN_PLACEHOLDERS[@]}"; do
    if [[ "$marker" == "$placeholder" ]]; then
      return 0
    fi
  done
  return 1
}

# Function: Check if spec/concern/task file exists
marker_exists_in_docs() {
  local marker="$1"
  local marker_type="${marker%%-*}"  # SPEC, CONCERN, TASK

  case "$marker_type" in
    SPEC)
      # Search for spec files containing marker ID
      find "$PROJECT_ROOT/docs/specs" -name "*.md" -type f 2>/dev/null | \
        xargs grep -l "$marker" 2>/dev/null | head -n1 | grep -q .
      ;;
    CONCERN)
      # Concerns documented in specs or separate concern docs
      find "$PROJECT_ROOT/docs" -name "*.md" -type f 2>/dev/null | \
        xargs grep -l "$marker" 2>/dev/null | head -n1 | grep -q .
      ;;
    TASK)
      # Tasks in plan files
      find "$PROJECT_ROOT/docs/plans" -name "*.md" -type f 2>/dev/null | \
        xargs grep -l "$marker" 2>/dev/null | head -n1 | grep -q .
      ;;
    TEST)
      # Tests self-document, no external reference needed
      return 0
      ;;
    INTERFACE)
      # Interface markers in docs
      find "$PROJECT_ROOT/docs" -name "*.md" -type f 2>/dev/null | \
        xargs grep -l "$marker" 2>/dev/null | head -n1 | grep -q .
      ;;
    *)
      return 1
      ;;
  esac
}

# Function: Validate markers in a file
validate_file() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}❌ File not found: $file${NC}"
    ERRORS=$((ERRORS + 1))
    return
  fi

  echo -e "${BLUE}Checking: $file${NC}"

  # Extract all markers (// SPEC-*, // CONCERN-*, etc.)
  local markers
  markers=$(grep -oP '(?<=// )(SPEC|CONCERN|TASK|TEST|INTERFACE)-[A-Z0-9_-]+' "$file" 2>/dev/null || true)

  if [[ -z "$markers" ]]; then
    echo -e "${YELLOW}  ⚠️  No markers found${NC}"
    WARNINGS=$((WARNINGS + 1))
    return
  fi

  local line_num
  while IFS= read -r marker; do
    # Get line number for context
    line_num=$(grep -n "$marker" "$file" | head -n1 | cut -d: -f1)

    # Check if it's a known placeholder
    if is_known_placeholder "$marker"; then
      echo -e "  ${YELLOW}⚠️  Line $line_num: $marker (placeholder)${NC}"
      WARNINGS=$((WARNINGS + 1))
      continue
    fi

    # Check if marker exists in docs
    if marker_exists_in_docs "$marker"; then
      echo -e "  ${GREEN}✅ Line $line_num: $marker (valid)${NC}"
      continue
    fi

    # Unknown marker - potential hallucination
    echo -e "  ${RED}❌ Line $line_num: $marker (NOT FOUND - hallucination?)${NC}"
    echo -e "     ${RED}→ Not found in docs/ and not a known placeholder${NC}"
    ERRORS=$((ERRORS + 1))
  done <<< "$markers"

  echo ""
}

# Main validation loop
if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <file1> <file2> ..."
  echo "   or: $0 \$(git diff --name-only)"
  exit 1
fi

for file in "$@"; do
  # Skip non-Rust files (adjust pattern as needed)
  if [[ "$file" =~ \.(rs|toml)$ ]]; then
    validate_file "$file"
  fi
done

# Summary
echo "================="
echo -e "${GREEN}Validated ${#@} files${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Errors: $ERRORS${NC}"
echo ""

# Exit code based on validation mode
if [[ $ERRORS -gt 0 ]]; then
  if [[ "$VALIDATION_MODE" == "error" ]]; then
    echo -e "${RED}❌ Validation FAILED (strict mode)${NC}"
    exit 2
  else
    echo -e "${YELLOW}⚠️  Validation warnings (lenient mode - can proceed)${NC}"
    exit 1
  fi
fi

if [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}⚠️  Validation passed with warnings${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Validation passed${NC}"
exit 0
