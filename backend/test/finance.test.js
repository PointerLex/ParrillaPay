const test = require("node:test");
const assert = require("node:assert/strict");
const { allocateCents, settleBalances } = require("../src/finance");

test("allocates every cent and keeps shares within one cent of each other", () => {
  const allocations = allocateCents(100, [8, 4, 2]);
  assert.deepEqual(allocations, [
    { userId: 8, cents: 34 },
    { userId: 4, cents: 33 },
    { userId: 2, cents: 33 },
  ]);
  assert.equal(allocations.reduce((sum, allocation) => sum + allocation.cents, 0), 100);
});

test("does not double count duplicate participants when allocating", () => {
  assert.deepEqual(allocateCents(5, [1, 1, 2]), [
    { userId: 1, cents: 3 },
    { userId: 2, cents: 2 },
  ]);
});

test("nets balances into the minimum direct transfers", () => {
  const settlements = settleBalances(new Map([[1, 1000], [2, -400], [3, -600]]));
  assert.deepEqual(settlements, [
    { debtorId: 2, creditorId: 1, cents: 400 },
    { debtorId: 3, creditorId: 1, cents: 600 },
  ]);
});

test("rejects an expense split with no eligible participants", () => {
  assert.throws(() => allocateCents(100, []));
});
