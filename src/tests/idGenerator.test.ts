import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Candidate ID Generator & Reservation Logic', () => {
  const HISTORICAL_MAX_ID_NUM = 1158;

  function simulateIdAllocation(lastStoredMax: number, count: number): { allocatedIds: string[]; newLastNum: number } {
    if (count <= 0) {
      throw new Error('Count must be greater than 0');
    }

    // Always start at or after HISTORICAL_MAX_ID_NUM (1158), never record count or random timestamp
    let currentMax = Math.max(HISTORICAL_MAX_ID_NUM, isNaN(lastStoredMax) ? HISTORICAL_MAX_ID_NUM : lastStoredMax);

    const ids: string[] = [];
    for (let i = 1; i <= count; i++) {
      const num = currentMax + i;
      ids.push(`NP-CAN-${String(num).padStart(6, '0')}`);
    }

    const newLastNum = currentMax + count;
    return { allocatedIds: ids, newLastNum };
  }

  it('allocates IDs starting strictly above historical max (1158) when counter is brand new', () => {
    const { allocatedIds, newLastNum } = simulateIdAllocation(0, 3);
    assert.strictEqual(allocatedIds.length, 3);
    assert.strictEqual(allocatedIds[0], 'NP-CAN-001159');
    assert.strictEqual(allocatedIds[1], 'NP-CAN-001160');
    assert.strictEqual(allocatedIds[2], 'NP-CAN-001161');
    assert.strictEqual(newLastNum, 1161);
  });

  it('generates contiguous sequential 6-digit padded blocks for bulk imports', () => {
    const { allocatedIds, newLastNum } = simulateIdAllocation(1200, 5);
    assert.strictEqual(allocatedIds.length, 5);
    assert.strictEqual(allocatedIds[0], 'NP-CAN-001201');
    assert.strictEqual(allocatedIds[1], 'NP-CAN-001202');
    assert.strictEqual(allocatedIds[2], 'NP-CAN-001203');
    assert.strictEqual(allocatedIds[3], 'NP-CAN-001204');
    assert.strictEqual(allocatedIds[4], 'NP-CAN-001205');
    assert.strictEqual(newLastNum, 1205);
  });

  it('never outputs timestamp-based or non-sequential IDs', () => {
    const { allocatedIds } = simulateIdAllocation(1158, 10);
    allocatedIds.forEach((id) => {
      assert.match(id, /^NP-CAN-\d{6}$/);
      const num = parseInt(id.replace('NP-CAN-', ''), 10);
      assert.ok(num > 1158, `Generated ID ${id} must be strictly greater than historical max 1158`);
    });
  });

  it('rejects invalid allocation requests with <= 0 counts', () => {
    assert.throws(() => simulateIdAllocation(1158, 0), /Count must be greater than 0/);
    assert.throws(() => simulateIdAllocation(1158, -5), /Count must be greater than 0/);
  });
});
