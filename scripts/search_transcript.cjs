const fs = require('fs');
const readline = require('readline');

async function searchPasswords() {
  const fileStream = fs.createReadStream('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\72a65fff-57af-4c51-8bac-63415f68831a\\.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.includes('NovaPulse@') || line.includes('SuperAdmin') || line.includes('Admin@') || line.includes('password') || line.includes('TempPassword')) {
      const parsed = JSON.parse(line);
      if (parsed.type === 'PLANNER_RESPONSE' && parsed.content && (parsed.content.includes('password') || parsed.content.includes('Password'))) {
        console.log('--- Step', parsed.step_index);
        console.log(parsed.content);
      }
    }
  }
}
searchPasswords().catch(console.error);
