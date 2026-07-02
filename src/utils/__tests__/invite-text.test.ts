import { describe, it, expect } from 'vitest';
import { buildInviteText, buildCopiedNotice } from '../invite-text';

const dict: Record<string, string> = {
  'listActions.inviteCode': '邀请码',
  'share.orOpenLink': '或打开链接：',
  'share.copied': '已复制',
  'share.description': '把清单发给家人，点开就能一起勾——不用注册',
};
const t = (k: string) => dict[k] ?? k;

describe('buildInviteText', () => {
  it('includes invite code line and link when short code exists', () => {
    const text = buildInviteText(t, 'L1', 'AB12', 'https://maisha.app');
    expect(text).toBe('邀请码：AB12\n或打开链接：https://maisha.app/list?list=L1');
  });

  it('falls back to bare link without short code', () => {
    expect(buildInviteText(t, 'L1', null, 'https://maisha.app')).toBe('https://maisha.app/list?list=L1');
  });
});

describe('buildCopiedNotice', () => {
  it('shows code and the narrative line', () => {
    expect(buildCopiedNotice(t, 'AB12')).toBe('已复制\n\nAB12\n\n把清单发给家人，点开就能一起勾——不用注册');
  });

  it('omits the code block without short code', () => {
    expect(buildCopiedNotice(t, null)).toBe('已复制\n\n把清单发给家人，点开就能一起勾——不用注册');
  });
});
