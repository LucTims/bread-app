import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { setupTestEnvironment, resetTestEnvironment } from './harness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('\n======================================================');
  console.log('       BoomRead PWA E2E Test Suite Runner            ');
  console.log('======================================================\n');

  setupTestEnvironment();

  const tiers = [
    { id: 'tier1_features', name: 'Tier 1: Feature Coverage (R1-R5)' },
    { id: 'tier2_boundaries', name: 'Tier 2: Boundary & Corner Cases' },
    { id: 'tier3_combinations', name: 'Tier 3: Cross-Feature Combinations' },
    { id: 'tier4_realworld', name: 'Tier 4: Real-World Application Scenarios' }
  ];

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  const tierSummaries = [];

  const startTime = Date.now();

  for (const tier of tiers) {
    const tierDir = path.join(__dirname, tier.id);
    console.log(`\n--- ${tier.name} ---`);

    if (!fs.existsSync(tierDir)) {
      console.log(`Directory ${tier.id} not found.`);
      continue;
    }

    const testFiles = fs.readdirSync(tierDir)
      .filter(file => file.endsWith('.test.js'))
      .sort();

    let tierCount = 0;
    let tierPassed = 0;
    let tierFailed = 0;

    for (const file of testFiles) {
      const filePath = path.join(tierDir, file);
      const fileUrl = pathToFileURL(filePath).href;

      try {
        const testModule = await import(fileUrl);
        const tests = testModule.default || testModule.tests || [];

        if (Array.isArray(tests)) {
          for (const test of tests) {
            tierCount++;
            resetTestEnvironment();
            const tStart = Date.now();
            try {
              await test.fn();
              const dur = Date.now() - tStart;
              tierPassed++;
              console.log(`  [PASS] ${test.name} (${dur}ms)`);
            } catch (err) {
              const dur = Date.now() - tStart;
              tierFailed++;
              console.log(`  [FAIL] ${test.name} (${dur}ms)`);
              console.log(`         Error: ${err.message}`);
            }
          }
        } else if (typeof testModule.run === 'function') {
          tierCount++;
          resetTestEnvironment();
          const tStart = Date.now();
          try {
            await testModule.run();
            const dur = Date.now() - tStart;
            tierPassed++;
            console.log(`  [PASS] ${file} (${dur}ms)`);
          } catch (err) {
            const dur = Date.now() - tStart;
            tierFailed++;
            console.log(`  [FAIL] ${file} (${dur}ms)`);
            console.log(`         Error: ${err.message}`);
          }
        }
      } catch (err) {
        tierCount++;
        tierFailed++;
        console.log(`  [FAIL] Failed to load ${file}: ${err.message}`);
      }
    }

    tierSummaries.push({
      tier: tier.name,
      total: tierCount,
      passed: tierPassed,
      failed: tierFailed
    });

    grandTotal += tierCount;
    grandPassed += tierPassed;
    grandFailed += tierFailed;
  }

  const totalTime = Date.now() - startTime;

  console.log('\n======================================================');
  console.log('                 E2E TEST SUMMARY                      ');
  console.log('======================================================');
  console.table(tierSummaries);

  console.log(`Total Tests Run : ${grandTotal}`);
  console.log(`Passed           : ${grandPassed}`);
  console.log(`Failed           : ${grandFailed}`);
  console.log(`Pass Rate        : ${grandTotal ? ((grandPassed / grandTotal) * 100).toFixed(1) : 0}%`);
  console.log(`Execution Time   : ${(totalTime / 1000).toFixed(2)}s`);
  console.log('======================================================\n');

  if (grandFailed > 0) {
    console.error(`\nFAILED: ${grandFailed} tests failed.`);
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${grandPassed} E2E tests passed!`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});
