"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import Layout from "@/components/Layout";
import { isAuthenticated } from "@/lib/auth";

// Bilingual landing. Language follows the app's i18n (react-i18next + localStorage detector,
// toggled from the Layout header), so the choice is remembered across pages/reloads.
const QUESTIONS = [
  {
    n: "01",
    icon: "👥",
    qEn: "WHO · WHAT",
    qZh: "为谁 · 做什么",
    bodyEn:
      "A collaboration system for interest / social / topic communities. Admins run the community — events, onboarding, incentives, tasks; members join, check in, earn points for tasks, and redeem them for coffee and swag.",
    bodyZh:
      "为兴趣、社交、话题小组等社区提供协作系统。管理员运营社区、办活动、发激励、派任务并检查；成员参与打卡、做任务拿积分、兑换咖啡与周边奖品。",
    aEn: "≈ member ops console + points/tasks + redemption shop",
    aZh: "≈ 会员运营后台 + 积分/任务系统 + 兑换商城",
  },
  {
    n: "02",
    icon: "✨",
    qEn: "WHY",
    qZh: "为何 · 用 Cos72",
    bodyEn:
      "Low-friction and open-source. Reputation / NFT (cross-community reputation) + xPNTs (in-community contribution) activate participation, so connections compound and communities last.",
    bodyZh:
      "低摩擦、开源。用 Reputation / NFT（跨社区通用的声誉）+ xPNTs（社区内的贡献记录）激活参与和贡献，让连接沉淀、社区可持续。",
    aEn: "Leave a trace · trusted contribution · portable honor",
    aZh: "参与留痕 · 贡献可信 · 荣誉带得走",
  },
  {
    n: "03",
    icon: "🧭",
    qEn: "HOW",
    qZh: "如何 · 开始用",
    bodyEn:
      "Create an account with a Passkey (no seed phrase, no gas), pick a limit profile, and enter your community. Follow 小J's comic tour to learn each feature.",
    bodyZh:
      "用 Passkey 建账户（无需助记词、无需 Gas），选一个额度画像进入你的社区。跟着小J的漫画漫游，一步步上手每个功能。",
    aEn: "Passkey to start · follow 小J",
    aZh: "Passkey 即用 · 跟着小J走",
  },
];

const FUTURE = [
  { name: "iDoris", en: "Community AI brain", zh: "社区 AI 大脑", icon: "🧠" },
  { name: "Hyphae", en: "Self-evolving agent", zh: "社区自进化 Agent", icon: "🌱" },
  { name: "Mycelium", en: "Community network", zh: "社区协作网络", icon: "🕸️" },
  { name: "More…", en: "More capabilities, growing", zh: "更多能力持续生长", icon: "✚" },
];

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { i18n } = useTranslation();
  const zh = (i18n.language || "en").toLowerCase().startsWith("zh");
  const L = (en: string, zhText: string) => (zh ? zhText : en);

  useEffect(() => {
    if (isAuthenticated()) router.push("/dashboard");
    else setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const primaryBtn =
    "w-full inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg transition active:scale-95";
  const ghostBtn =
    "w-full inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-95";

  return (
    <Layout>
      <style>{`
        @keyframes cosFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes cosFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .cos-fade { animation: cosFadeUp .5s ease both; }
        .cos-fade-2 { animation: cosFadeUp .5s ease .1s both; }
        .cos-fade-3 { animation: cosFadeUp .5s ease .2s both; }
        .cos-float { animation: cosFloat 4s ease-in-out infinite; }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="max-w-6xl mx-auto px-4 pt-14 pb-10 sm:pt-20 sm:pb-16">
          {/* Language toggle (visible on the logged-out landing; persists via i18n detector). */}
          <div className="flex justify-end -mt-6 mb-2">
            <button
              onClick={() => i18n.changeLanguage(zh ? "en" : "zh")}
              className="rounded-full border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-800/70 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-gray-500 transition"
            >
              {zh ? "EN" : "中文"}
            </button>
          </div>
          {/* Hero — left: explanation · right: sign-in/up */}
          <div className="grid gap-8 lg:grid-cols-5 lg:items-center cos-fade">
            {/* Left */}
            <div className="lg:col-span-3 text-center lg:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
                <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                  Cos72 · <strong>Co</strong>operation&nbsp;<strong>S</strong>ystem
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                  🚧 {L("Dev / Test build", "开发测试版")}
                </span>
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight text-gray-900 dark:text-white">
                {L("Tune community collaboration to the golden ratio", "把社区协作，调到黄金比例")}
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {L("Cos72 is ", "Cos72 取自 ")}
                <span className="font-mono">cos 72°</span>
                {L(" — the golden-ratio angle, symbolizing the ", " —— 黄金分割的角度，象征")}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {L("best collaboration mode", "最佳协作模式")}
                </span>
                {L(".", "。")}
              </p>
              <p className="mt-4 text-base text-gray-600 dark:text-gray-300 max-w-xl mx-auto lg:mx-0">
                {L("Give your community a ", "给你的社区配一套 ")}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {L(
                    "member account + points + redemption shop + reputation",
                    "会员账号 + 积分 + 兑换商城 + 声誉体系"
                  )}
                </span>
                {L(" — ", " —— 但")}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {L(
                    "open-source, free, and the data & points stay with the community",
                    "开源、免费、数据和积分都归社区自己"
                  )}
                </span>
                {L(".", "。")}
              </p>
              <div className="mt-6 flex items-center gap-3 justify-center lg:justify-start">
                <Image
                  src="/xiaoj.png"
                  alt="小J"
                  width={64}
                  height={128}
                  className="cos-float drop-shadow"
                />
                <a
                  href="https://tour.mushroom.cv"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300 dark:border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                >
                  {L("Tour with 小J →", "跟小J逛一圈 →")}
                </a>
              </div>
            </div>

            {/* Right — integrated sign-in / sign-up */}
            <div className="lg:col-span-2 cos-fade-2">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/70 p-6 shadow-lg backdrop-blur">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {L("Get started", "开始使用")}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {L(
                    "Passkey to start — no seed phrase, no wallet download, no gas.",
                    "Passkey 即用 —— 无需助记词、无需下载钱包、无需 Gas。"
                  )}
                </p>
                <div className="mt-4 space-y-3">
                  <button onClick={() => router.push("/auth/register")} className={primaryBtn}>
                    {L(
                      "Create with Fingerprint / Face / Passkey",
                      "指纹 / 刷脸 / Passkey 创建账户"
                    )}
                  </button>
                  <button onClick={() => router.push("/auth/login")} className={ghostBtn}>
                    {L("Have an account? Sign in", "已有账户？登录")}
                  </button>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
                  {L(
                    "🛡️ Asked to be someone's guardian? Open the link / QR they send — sign with Face ID / fingerprint, no wallet and no install. Tip: sign in to iCloud / Google so your passkey syncs across devices.",
                    "🛡️ 有人请你当守护人（guardian）？打开他发来的链接 / 二维码，用 Face ID / 指纹签名即可 —— 无需钱包、无需安装。提示：登录 iCloud / Google 让 passkey 跨设备同步。"
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* The 3 questions */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3 cos-fade-3">
            {QUESTIONS.map(q => (
              <div
                key={q.n}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/50 p-5 backdrop-blur transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-2xl">{q.icon}</span>
                  <span className="text-xs font-mono text-gray-400">{q.n}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {L(q.qEn, q.qZh)}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {L(q.bodyEn, q.bodyZh)}
                </p>
                <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {L(q.aEn, q.aZh)}
                </p>
              </div>
            ))}
          </div>

          {/* Roadmap — future features */}
          <div className="mt-12">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {L("Roadmap", "未来规划")}
              </h2>
              <span className="text-xs text-gray-400">
                {L("Community capabilities that keep growing", "Roadmap · 持续生长的社区能力")}
              </span>
            </div>
            <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-4">
              {FUTURE.map(f => (
                <div
                  key={f.name}
                  className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/30 p-4 text-center transition hover:-translate-y-0.5 hover:border-emerald-400"
                >
                  <div className="text-2xl">{f.icon}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {f.name}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {L(f.en, f.zh)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
