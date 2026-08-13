import localforage from 'localforage';
import { enqueueReadingStats, getSyncQueue, flushSyncQueue, clearSyncQueueItem } from '../../src/lib/offlineStore.js';

// Setup fake localStorage if needed in Node
if (typeof localStorage === 'undefined') {
  globalThis.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
}

// Setup fake navigator if needed in Node
if (typeof navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
}

async function runEmpiricalConcurrencyTest() {
  console.log("=== EMPIRICAL CONCURRENCY & PERFORMANCE TEST SUITE ===");

  // 1. Clear queue before test
  const queueStore = localforage.createInstance({
    name: 'bread-app',
    storeName: 'sync_queue'
  });
  await queueStore.clear();

  // Test Case 1: Re-entrancy Mutex & Dual Trigger Race Condition
  console.log("\n--- Test 1: Re-entrancy Mutex & Dual Concurrent Triggers ---");
  await enqueueReadingStats('book_race_1', 10, 50, 200);
  await enqueueReadingStats('book_race_2', 5, 25, 100);

  let rpcCallCount = 0;
  const processedBookIds = [];

  const mockSupabase = {
    rpc: async (fnName, params) => {
      rpcCallCount++;
      // Add artificial async delay (50ms) to simulate network latency
      await new Promise(resolve => setTimeout(resolve, 50));
      return { error: null };
    }
  };

  // Fire two concurrent flushSyncQueue calls simultaneously (simulating isOnline state change + 'connectivity-changed' event)
  const t0 = Date.now();
  const p1 = flushSyncQueue(mockSupabase);
  const p2 = flushSyncQueue(mockSupabase);
  const p3 = flushSyncQueue(mockSupabase);

  await Promise.all([p1, p2, p3]);
  const dur1 = Date.now() - t0;

  console.log(`Concurrent flushes completed in ${dur1}ms`);
  console.log(`RPC invocation count: ${rpcCallCount} (Expected: 2, 1 for each item in queue)`);
  
  const remainingQueue1 = await getSyncQueue();
  console.log(`Remaining items in queue: ${remainingQueue1.length} (Expected: 0)`);

  if (rpcCallCount === 2 && remainingQueue1.length === 0) {
    console.log("✅ TEST 1 PASSED: Re-entrancy mutex prevented double-flushing!");
  } else {
    console.error("❌ TEST 1 FAILED: Double-flush or lock leak occurred!");
  }

  // Test Case 2: Non-blocking performance benchmark (<200ms overhead)
  console.log("\n--- Test 2: Queue Processing Non-Blocking Performance ---");
  await queueStore.clear();

  // Enqueue 10 reading sessions
  for (let i = 1; i <= 10; i++) {
    await enqueueReadingStats(`perf_book_${i}`, i, i * 10, 100);
  }

  const fastMockSupabase = {
    rpc: async () => {
      // Instant RPC resolution
      return { error: null };
    }
  };

  const tStart = Date.now();
  await flushSyncQueue(fastMockSupabase);
  const perfDur = Date.now() - tStart;

  console.log(`Flushed 10 items in ${perfDur}ms (Limit: <200ms)`);
  const remainingQueue2 = await getSyncQueue();
  console.log(`Remaining items: ${remainingQueue2.length} (Expected: 0)`);

  if (perfDur < 200 && remainingQueue2.length === 0) {
    console.log(`✅ TEST 2 PASSED: Processing execution non-blocking overhead overhead was ${perfDur}ms (<200ms requirement)`);
  } else {
    console.error(`❌ TEST 2 FAILED: Execution duration ${perfDur}ms exceeded 200ms limit!`);
  }

  // Test Case 3: Error Isolation & Partial Failures
  console.log("\n--- Test 3: Partial Failure Isolation ---");
  await queueStore.clear();

  await enqueueReadingStats('good_book_1', 2, 10, 50);
  await enqueueReadingStats('failing_book_2', 3, 15, 50);
  await enqueueReadingStats('good_book_3', 4, 20, 50);

  const partialMockSupabase = {
    rpc: async (fn, params) => {
      // Item 2 fails
      if (params.pages_read === 3) {
        return { error: { message: '500 Server Error', status: 500 } };
      }
      return { error: null };
    }
  };

  await flushSyncQueue(partialMockSupabase);
  const remainingQueue3 = await getSyncQueue();
  console.log(`Remaining items after partial failure: ${remainingQueue3.length} (Expected: 1, failing_book_2)`);

  if (remainingQueue3.length === 1 && remainingQueue3[0].bookId === 'failing_book_2') {
    console.log("✅ TEST 3 PASSED: Partial failure isolated successfully, failing item retained!");
  } else {
    console.error("❌ TEST 3 FAILED: Incorrect queue state after partial failure!");
  }

  console.log("\n=== ALL CONCURRENCY & PERFORMANCE HARNESS TESTS COMPLETE ===");
}

runEmpiricalConcurrencyTest().catch(err => {
  console.error("Fatal test error:", err);
});
