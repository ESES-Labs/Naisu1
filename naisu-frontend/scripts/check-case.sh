#!/bin/bash
# Check for case-sensitive import issues
# Run this before committing to catch Mac/Linux case sensitivity issues

echo "🔍 Checking for case-sensitive import issues..."

# Check for lowercase imports of UI components
LOWERCASE_IMPORTS=$(grep -r "from ['\"]@/components/ui/[a-z]" src --include="*.tsx" --include="*.ts" 2>/dev/null || true)

if [ -n "$LOWERCASE_IMPORTS" ]; then
  echo "❌ Found lowercase imports (should be PascalCase):"
  echo "$LOWERCASE_IMPORTS"
  echo ""
  echo "Fix: Rename imports to use PascalCase (e.g., @/components/ui/button -> @/components/ui/Button)"
  exit 1
else
  echo "✅ All imports use correct PascalCase"
fi

# Check for inconsistent file casing in components/ui
echo "🔍 Checking UI component file names..."
cd src/components/ui

for file in *.tsx; do
  if [[ "$file" =~ ^[a-z] ]]; then
    echo "⚠️  File should be PascalCase: $file"
    exit 1
  fi
done

echo "✅ All UI component files use PascalCase"
exit 0
