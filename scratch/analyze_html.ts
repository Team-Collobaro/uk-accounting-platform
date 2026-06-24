import * as fs from 'fs';
import * as cheerio from 'cheerio';

const htmlPath = '/Users/ravindusandun/Documents/TeamCollaboro/uk-accounting-platform/UK_Master_Course 1-1 (1).html';
const html = fs.readFileSync(htmlPath, 'utf-8');
const $ = cheerio.load(html);

const outline: string[] = [];

$('h1, h2, h3').each((i, el) => {
  const text = $(el).text().replace(/\s+/g, ' ').trim();
  const tagName = el.tagName.toLowerCase();
  
  if (tagName === 'h1') {
    outline.push(`\n# ${text}`);
  } else if (tagName === 'h2') {
    outline.push(`## ${text}`);
  } else if (tagName === 'h3') {
    outline.push(`### ${text}`);
  }
});

fs.writeFileSync('scratch/html_outline.txt', outline.join('\n'));
console.log(`Extracted ${outline.length} headings.`);
