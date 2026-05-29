import { describe, test, expect, beforeEach } from 'vitest';
import { getDurableStore, __setDurableStoreForTest } from '@/lib/durable-store';

describe('durable-store (web no-op)', () => {
  beforeEach(() => __setDurableStoreForTest(null));

  test('load() returns null on web', async () => {
    expect(await getDurableStore().load()).toBeNull();
  });

  test('save() and clear() resolve without throwing on web', async () => {
    await expect(
      getDurableStore().save({ accountId: 'a', recoveryCode: 'C' })
    ).resolves.toBeUndefined();
    await expect(getDurableStore().clear()).resolves.toBeUndefined();
  });
});
