import { currentSeller } from "@/lib/auth";
import { aiConfigured, paypalConfigured, env } from "@/lib/env";
import { SettingsForm } from "./SettingsForm";

export default async function Settings() {
  const s = (await currentSeller())!;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm seller={{ name: s.name, slug: s.slug, paypal_email: s.paypal_email, auto_release_hours: s.auto_release_hours, is_demo: s.is_demo }} />
      <div className="card p-5 text-sm">
        <h3 className="mb-3 font-semibold">Integrations</h3>
        <div className="flex justify-between py-1"><span>PayPal</span><span className={paypalConfigured() ? "text-brand" : "text-warn"}>{paypalConfigured() ? `Sandbox connected (${env.paypalBase.replace("https://", "")})` : "Demo payments, PayPal sandbox not connected"}</span></div>
        <div className="flex justify-between py-1"><span>AI</span><span className={aiConfigured() ? "text-brand" : "text-warn"}>{aiConfigured() ? `Vercel AI Gateway · ${env.aiModel}` : "Rules fallback (no AI key)"}</span></div>
        <div className="flex justify-between py-1"><span>Notifications</span><span className="text-mute">In-app log</span></div>
      </div>
    </div>
  );
}
