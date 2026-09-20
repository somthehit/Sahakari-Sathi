import fs from 'fs/promises';
import path from 'path';

const SRC_DIR = './src';

// We want to replace standard dark mode classes with their light mode equivalents.
// For example, card backgrounds bg-slate-900 -> bg-white
// text-slate-300 -> text-slate-600
// border-slate-700 -> border-slate-200
// Custom dark backgrounds like bg-[#0b1220] -> bg-white

const replacementRules = [
  // Remove dark: variants entirely
  { pattern: /dark:hover:bg-[a-z0-9\-]+\s?/g, replace: '' },
  { pattern: /dark:bg-[a-z0-9\-]+\s?/g, replace: '' },
  { pattern: /dark:text-[a-z0-9\-]+\s?/g, replace: '' },
  { pattern: /dark:border-[a-z0-9\-]+\s?/g, replace: '' },
  { pattern: /dark:ring-[a-z0-9\-]+\s?/g, replace: '' },
  { pattern: /dark:[a-z0-9\-:]+\s?/g, replace: '' },

  // Replace dark hex backgrounds with bg-white or bg-slate-50
  { pattern: /bg-\[#(0[0-9a-fA-F]{5}|1[0-9a-fA-F]{5})\](\/\d+)?/g, replace: 'bg-white' },
  { pattern: /bg-\[#0b1220\]/g, replace: 'bg-white' },
  { pattern: /bg-\[#0f172a\]/g, replace: 'bg-slate-50' },
  { pattern: /bg-\[#020617\]/g, replace: 'bg-white' },
  { pattern: /bg-\[#111827\]/g, replace: 'bg-slate-50' },

  // Backgrounds: slate/gray/blue/zinc/neutral/stone 950/900/800 -> white or slate-50
  // Note: we replace 950 and 900 with bg-white, 800 with bg-slate-50 to keep some hierarchy if they were nested.
  { pattern: /bg-(slate|gray|blue|zinc|neutral|stone)-950(\/\d+)?/g, replace: 'bg-white' },
  { pattern: /bg-(slate|gray|blue|zinc|neutral|stone)-900(\/\d+)?/g, replace: 'bg-white' },
  { pattern: /bg-(slate|gray|blue|zinc|neutral|stone)-800(\/\d+)?/g, replace: 'bg-slate-50' },

  // Hover backgrounds
  { pattern: /hover:bg-(slate|gray|blue|zinc|neutral|stone)-900(\/\d+)?/g, replace: 'hover:bg-slate-50' },
  { pattern: /hover:bg-(slate|gray|blue|zinc|neutral|stone)-800(\/\d+)?/g, replace: 'hover:bg-slate-100' },
  { pattern: /hover:bg-(slate|gray|blue|zinc|neutral|stone)-700(\/\d+)?/g, replace: 'hover:bg-slate-200' },

  // Borders: 700/800/900 -> 200/300
  { pattern: /border-(slate|gray|blue|zinc|neutral|stone)-800/g, replace: 'border-slate-200' },
  { pattern: /border-(slate|gray|blue|zinc|neutral|stone)-700/g, replace: 'border-slate-300' },
  { pattern: /border-(slate|gray|blue|zinc|neutral|stone)-900/g, replace: 'border-slate-200' },

  // Text colors
  { pattern: /text-(slate|gray|blue|zinc|neutral|stone)-400/g, replace: 'text-slate-500' },
  { pattern: /text-(slate|gray|blue|zinc|neutral|stone)-300/g, replace: 'text-slate-600' },
  { pattern: /text-(slate|gray|blue|zinc|neutral|stone)-200/g, replace: 'text-slate-700' },
  { pattern: /text-(slate|gray|blue|zinc|neutral|stone)-100/g, replace: 'text-slate-800' },
];

async function processDirectory(directory) {
  const files = await fs.readdir(directory, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    
    if (file.isDirectory()) {
      await processDirectory(fullPath);
    } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts')) {
      await processFile(fullPath);
    }
  }
}

async function processFile(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  let originalContent = content;

  // Process rules
  for (const rule of replacementRules) {
    content = content.replace(rule.pattern, rule.replace);
  }

  // Smart fix: if a class string now contains "bg-white" or "bg-slate-50" and "text-white", 
  // it might be invisible. Let's fix text-white in light backgrounds unless it's a primary button.
  // Primary buttons typically have bg-emerald-x or bg-blue-600+, etc.
  
  // A regex to find className="..." or className={`...`} strings
  const classStringRegex = /className=(?:["']([^"']+)["']|\{`([^`]+)`\})/g;
  
  content = content.replace(classStringRegex, (match, p1, p2) => {
    let classStr = p1 || p2;
    if (!classStr) return match;

    // Check if it has a light background we just added or already had
    const hasLightBg = /(bg-white|bg-slate-50|bg-slate-100)/.test(classStr);
    
    // Check if it has a primary/strong background
    const hasStrongBg = /(bg-emerald-[56789]00|bg-blue-[56789]00|bg-rose-[56789]00|bg-red-[56789]00|bg-amber-[56789]00|bg-\[#006130\])/.test(classStr);

    // Some texts were explicitly set to white on dark cards.
    if ((hasLightBg || !hasStrongBg) && classStr.includes('text-white')) {
      // Only replace if it doesn't have a strong bg
      if (!hasStrongBg) {
        classStr = classStr.replace(/\btext-white\b/g, 'text-slate-800');
      }
    }

    // Clean up multiple spaces
    classStr = classStr.replace(/\s+/g, ' ').trim();

    if (p1) return `className="${classStr}"`;
    if (p2) return `className={\`${classStr}\`}`;
    return match;
  });

  if (content !== originalContent) {
    console.log(`Updated: ${filePath}`);
    await fs.writeFile(filePath, content, 'utf8');
  }
}

processDirectory(SRC_DIR).catch(console.error);
