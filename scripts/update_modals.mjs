import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p, callback);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      callback(p);
    }
  }
}

let modified = 0;

walk('./src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  // 1. Update modal backdrops
  newContent = newContent.replace(/bg-black\/[0-9]+ backdrop-blur-[a-z]+/g, 'bg-slate-900/20 backdrop-blur-sm');
  newContent = newContent.replace(/bg-white backdrop-blur-[a-z]+/g, 'bg-slate-900/20 backdrop-blur-sm');

  // 2. Update Cancel buttons
  // Typically: className="... text-slate-600 hover:text-slate-900 ..." for Cancel
  // We want to make them solid light buttons
  newContent = newContent.replace(/className="[^"]*text-slate-600[^"]*"([^>]*>Cancel<\/button>)/g, 'className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"$1');
  newContent = newContent.replace(/className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition cursor-pointer"([^>]*>Cancel<\/button>)/g, 'className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"$1');

  // 3. Update required asterisks to emerald-600
  newContent = newContent.replace(/<span className="text-rose-500">\*<\/span>/g, '<span className="text-emerald-600">*</span>');
  newContent = newContent.replace(/<span className="text-emerald-600"> \*<\/span>/g, '<span className="text-emerald-600">*</span>');
  
  // 4. Update input classes to include placeholder-slate-400 if not present
  newContent = newContent.replace(/w-full bg-slate-50 border/g, 'w-full bg-slate-50 border placeholder-slate-400');
  // Avoid duplicate placeholder-slate-400
  newContent = newContent.replace(/placeholder-slate-400.*?placeholder-slate-400/g, 'placeholder-slate-400');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    modified++;
    console.log(`Updated ${filePath}`);
  }
});

console.log(`Done. Modified ${modified} files.`);
