import { generateQuiz } from '../lib/anthropic';
import 'dotenv/config';

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
    const res = await generateQuiz({ module: mod, ragContext: mod.content, count: 2 });
    console.log('Success:', res);
  } catch (err: any) {
    console.error('Error:', err.message || err);
  }
}
run();
