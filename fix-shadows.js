const fs = require('fs');
const glob = require('glob');

const files = glob.sync('{app,components}/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace various black shadows
  const replacements = [
    { regex: /boxShadow:\s*['`"]inset 0 2px 6px rgba\(0,0,0,0\.35\)['`"]/g, replacement: "boxShadow: 'var(--shadow-sm)'" },
    { regex: /boxShadow:\s*['`"]0 4px 24px rgba\(0,0,0,0\.[45]\)['`"]/g, replacement: "boxShadow: 'var(--shadow-md)'" },
    { regex: /boxShadow:\s*['`"]0 8px 40px rgba\(0,0,0,0\.[45]\)['`"]/g, replacement: "boxShadow: 'var(--shadow-lg)'" },
    { regex: /boxShadow:\s*['`"]inset 0 1px 2px rgba\(0,0,0,0\.4\)['`"]/g, replacement: "boxShadow: 'var(--shadow-sm)'" },
    { regex: /boxShadow:\s*['`"]2px 0 18px rgba\(0,0,0,0\.4\)([^'`"]*)['`"]/g, replacement: "boxShadow: 'var(--shadow-md)'" },
    { regex: /boxShadow:\s*['`"]inset 0 -1px 0 rgba\(78,205,196,0\.06\),\s*0 4px 40px rgba\(0,0,0,0\.3\)['`"]/g, replacement: "boxShadow: 'var(--shadow-lg)'" },
    { regex: /boxShadow:\s*['`"]0 10px 40px rgba\(0,0,0,0\.2\)['`"]/g, replacement: "boxShadow: 'var(--shadow-lg)'" },
    { regex: /boxShadow:\s*[`'"]0 8px 40px rgba\(0,0,0,0\.5\),\s*0 0 30px \$\{color\}20[`'"]/g, replacement: "boxShadow: `var(--shadow-lg), 0 0 30px ${color}20`" },
    { regex: /boxShadow:\s*['`"]0 4px 32px rgba\(0,0,0,0\.4\)([^'`"]*)['`"]/g, replacement: "boxShadow: 'var(--shadow-lg)'" },
    { regex: /boxShadow:\s*['`"]0 2px 16px rgba\(0,0,0,0\.3\)['`"]/g, replacement: "boxShadow: 'var(--shadow-md)'" },
    { regex: /boxShadow:\s*['`"]0 2px 8px rgba\(0,0,0,0\.3\)['`"]/g, replacement: "boxShadow: 'var(--shadow-sm)'" },
    { regex: /boxShadow:\s*['`"]inset 0 2px 8px rgba\(0,0,0,0\.4\)['`"]/g, replacement: "boxShadow: 'var(--shadow-sm)'" }
  ];

  for (const r of replacements) {
    if (r.regex.test(content)) {
      content = content.replace(r.regex, r.replacement);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated shadows in ${file}`);
  }
});
