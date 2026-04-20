// Diagnose formatting issues in AI/ML questions
import { readFileSync } from 'node:fs';

const HTML_PATH = 'DevOps_Interview.html';
const html = readFileSync(HTML_PATH, 'utf-8');

const startMarker = 'var DATA=';
const startIdx = html.indexOf(startMarker);
if (startIdx < 0) throw new Error('DATA marker not found');
const jsonStart = startIdx + startMarker.length;

// The DATA object ends with }]}; — find the LAST one before the next script/end.
// Heuristic: scan forward from start, track brace depth.
let depth = 0;
let inString = false;
let escape = false;
let endIdx = -1;
for (let i = jsonStart; i < html.length; i++) {
  const c = html[i];
  if (escape) { escape = false; continue; }
  if (c === '\\') { escape = true; continue; }
  if (c === '"') { inString = !inString; continue; }
  if (inString) continue;
  if (c === '{') depth++;
  else if (c === '}') {
    depth--;
    if (depth === 0) { endIdx = i + 1; break; }
  }
}
if (endIdx < 0) throw new Error('DATA end not found');

const dataStr = html.slice(jsonStart, endIdx);
const data = JSON.parse(dataStr);

console.log('Categories:', data.categories.length);
console.log('Questions:', data.questions.length);

const aiml = data.questions.filter(q => q.category === 'Вопросы по AI/ML в DevOps');
console.log('AI/ML questions:', aiml.length);

console.log('\n=== Format check ===');
for (const q of aiml) {
  const ans = q.answer;
  // Signs of broken formatting:
  // - Many `</p>\n<p>` in a row (>15 suggests broken)
  // - Broken code: `<p>pickle.dump(` or `<p>with open(`
  // - em-dashes as `--`
  const pBreaks = (ans.match(/<\/p>\n<p>/g) || []).length;
  const badCode = /<p>(pickle|with open|model\s*=|import |from |def |return |super|\s+self\.)/.test(ans);
  const dashDash = / -- /.test(ans);
  const broken = pBreaks > 15 || badCode || dashDash;
  console.log(`id=${q.id} num=${q.num} ${broken ? '[BROKEN]' : '[ok]   '} pBreaks=${pBreaks} code=${badCode} dash=${dashDash}  :: ${q.text.slice(0, 60)}`);
}

console.log('\n=== Max id/num ===');
const maxId = Math.max(...data.questions.map(q => q.id));
const maxNum = Math.max(...data.questions.map(q => q.num));
console.log('maxId:', maxId, 'maxNum:', maxNum);
