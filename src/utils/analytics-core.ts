export type EventName =
  | 'add_item'
  | 'complete_trip'
  | 'share_link_open'
  | 'list_join'
  | 'store_finder_used';

export interface EventRow {
  uid: string;
  name: EventName;
  list_id: string | null;
  props: Record<string, unknown>;
  platform: string;
  lang: string;
  ua_env: 'wechat' | 'other';
  env: 'dev' | 'prod';
}

export interface EventContext {
  ua: string;
  platform: string;
  lang: string;
  env: 'dev' | 'prod';
}

export interface TrackOptions {
  listId?: string;
  props?: Record<string, unknown>;
}

// 微信内置浏览器识别——share_link_open 的 ua_env 分布是微信假设验证的关键口径
export function uaEnv(ua: string): 'wechat' | 'other' {
  return /MicroMessenger/i.test(ua) ? 'wechat' : 'other';
}

export function buildEventRow(
  name: EventName,
  uid: string,
  ctx: EventContext,
  opts: TrackOptions = {}
): EventRow {
  return {
    uid,
    name,
    list_id: opts.listId ?? null,
    props: opts.props ?? {},
    platform: ctx.platform,
    lang: ctx.lang,
    ua_env: uaEnv(ctx.ua),
    env: ctx.env,
  };
}
