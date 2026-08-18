import fs from 'fs';
import * as cheerio from 'cheerio';

function extractHooks() {
  const html = fs.readFileSync('oldveriosn.html', 'utf-8');
  const $ = cheerio.load(html);
  
  const rawData = JSON.parse(fs.readFileSync('lib/courseDataRaw.json', 'utf-8'));
  
  const hooks: string[] = [];
  $('.module-hook').each((i, el) => {
    hooks.push($(el).text().trim());
  });
  
  console.log(`Found ${hooks.length} hooks. Modules count: ${rawData.length}`);
  
  if (hooks.length === rawData.length) {
    rawData.forEach((mod: any, index: number) => {
      mod.hookHtml = $( $('.module-hook')[index] ).html();
      mod.hookText = hooks[index];
    });
    fs.writeFileSync('scratch/courseDataRaw_updated.json', JSON.stringify(rawData, null, 2));
    console.log('Successfully extracted and matched hooks.');
  } else {
    console.error('Mismatch between number of hooks and number of modules.');
  }
}

extractHooks();
