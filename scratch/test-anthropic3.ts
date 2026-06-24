import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { generateQuiz } from '../lib/anthropic';

async function run() {
  try {
    const mod = {
      id: "m01",
      title: "Module 1",
      partNumber: 1,
      partTitle: "Part 1",
      content: "This is a test content about UK taxation.",
      order: 0,
    };
    console.log("Generating quiz...");
    const res = await generateQuiz({ module: mod, ragContext: mod.content, count: 2 });
    console.log("Generated:", res.length, "questions");
  } catch (err: any) {
    console.error('Error:', err.message || err);
    if (err.cause) console.error('Cause:', err.cause);
  }
}
run();
