import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const nav = useNavigate();

  return (
    <div className="p-4 min-h-screen">
      <header className="flex items-center mb-4">
        <button onClick={() => nav(-1)} className="text-primary text-sm mr-3">‹ 返回</button>
        <div className="text-base font-semibold">隐私政策</div>
      </header>

      <div className="bg-white rounded-xl p-5 text-sm leading-relaxed space-y-4" style={{ color: '#5a4e3c' }}>
        <p className="text-xs" style={{ color: '#a0937e' }}>最后更新：2026 年 7 月</p>

        <section>
          <h2 className="font-semibold mb-1">我们是谁</h2>
          <p>「买啥 MaiSha」是一款轻量级共享购物清单应用，帮助家庭成员协作管理日常采购。</p>
        </section>

        <section>
          <h2 className="font-semibold mb-1">我们收集什么</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>匿名身份标识</strong> — 我们使用匿名认证，不收集姓名、邮箱、手机号等个人信息。</li>
            <li><strong>购物清单数据</strong> — 你添加的商品名称、数量、备注、所属超市等信息。</li>
            <li><strong>采购历史</strong> — 每次结账时的商品快照和可选的花费金额。</li>
            <li><strong>自定义图标</strong> — 你上传或通过 AI 生成的食材图标。</li>
            <li><strong>匿名使用统计</strong> — 少量功能使用事件（如添加商品、完成采购），仅关联匿名标识，用于改进产品；不含设备指纹，不用于广告。</li>
            <li><strong>错误诊断日志</strong> — 应用出错时收集错误堆栈与设备环境信息（经 Sentry），仅用于定位和修复问题。</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-1">我们不收集什么</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>不收集真实姓名、邮箱、电话号码</li>
            <li>不后台追踪地理位置——仅在你主动使用「查超市」时，于设备本地读取位置用于附近搜索（Apple 地图）；我们的服务器不接收、不存储你的位置</li>
            <li>不投放广告、不使用广告追踪</li>
            <li>不将数据出售给第三方</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-1">数据如何共享</h2>
          <p>你的购物清单仅与你主动邀请的家庭成员共享。只有通过邀请链接或邀请码加入的用户才能看到你的清单数据。我们不会将数据分享给清单成员以外的任何人。</p>
        </section>

        <section>
          <h2 className="font-semibold mb-1">数据存储</h2>
          <p>数据存储在 Supabase 提供的云端数据库中，通过行级安全策略（RLS）确保只有清单成员才能访问数据。自定义图标存储在安全的云存储桶中。</p>
        </section>

        <section>
          <h2 className="font-semibold mb-1">第三方服务</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Supabase</strong> — 数据库、认证、实时同步</li>
            <li><strong>Cloudflare</strong> — 应用托管与内容分发</li>
            <li><strong>Sentry</strong> — 错误诊断（仅在应用出错时收集技术信息）</li>
            <li><strong>AI 图标生成</strong> — 可选功能，仅在你主动使用时调用</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-1">数据删除</h2>
          <p>你可以随时删除清单中的任何商品。如需完全删除账户数据，请联系我们。由于使用匿名认证，清除浏览器数据或卸载应用即可断开与数据的关联。</p>
        </section>

        <section>
          <h2 className="font-semibold mb-1">儿童隐私</h2>
          <p>本应用不面向 13 岁以下儿童，也不会有意收集儿童的个人信息。</p>
        </section>

        <section>
          <h2 className="font-semibold mb-1">政策更新</h2>
          <p>如隐私政策有重大变更，我们会在应用内通知。继续使用即表示接受更新后的政策。</p>
        </section>

        <section>
          <h2 className="font-semibold mb-1">联系方式</h2>
          <p>如有疑问，请通过应用内反馈渠道联系我们。</p>
        </section>
      </div>
    </div>
  );
}
