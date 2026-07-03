import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import i18n from '@/i18n';
import { buildEventRow, type EventName, type TrackOptions } from '@/utils/analytics-core';

// fire-and-forget：埋点任何失败（无会话/断网/表未建）都静默吞掉，绝不影响主流程
export function track(name: EventName, opts: TrackOptions = {}): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;
      const row = buildEventRow(name, uid, {
        ua: navigator.userAgent,
        platform: Capacitor.getPlatform(),
        lang: i18n.resolvedLanguage ?? i18n.language,
        env: import.meta.env.PROD ? 'prod' : 'dev',
      }, opts);
      await supabase.from('events').insert(row);
    } catch {
      /* 静默 */
    }
  })();
}
