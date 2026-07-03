import { describe, it, expect } from 'vitest';
import { buildEventRow, uaEnv } from '../analytics-core';

const WECHAT_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44';
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('uaEnv', () => {
  it('detects WeChat in-app browser', () => {
    expect(uaEnv(WECHAT_UA)).toBe('wechat');
  });
  it('treats everything else as other', () => {
    expect(uaEnv(SAFARI_UA)).toBe('other');
    expect(uaEnv('')).toBe('other');
  });
});

describe('buildEventRow', () => {
  const ctx = { ua: SAFARI_UA, platform: 'ios', lang: 'zh-CN', env: 'prod' as const };

  it('builds a full row with defaults', () => {
    const row = buildEventRow('add_item', 'uid-1', ctx);
    expect(row).toEqual({
      uid: 'uid-1',
      name: 'add_item',
      list_id: null,
      props: {},
      platform: 'ios',
      lang: 'zh-CN',
      ua_env: 'other',
      env: 'prod',
    });
  });

  it('carries listId and props through', () => {
    const row = buildEventRow('complete_trip', 'uid-2', { ...ctx, ua: WECHAT_UA }, {
      listId: 'L1',
      props: { items: 8, store: 'T&T' },
    });
    expect(row.list_id).toBe('L1');
    expect(row.props).toEqual({ items: 8, store: 'T&T' });
    expect(row.ua_env).toBe('wechat');
  });
});
