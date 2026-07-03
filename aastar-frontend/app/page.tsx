"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Layout from "@/components/Layout";
import { isAuthenticated } from "@/lib/auth";

// The 3-question landing. DRAFT copy — Chinese-primary (target = Chinese-speaking communities);
// i18n / language toggle can be layered later. Analogies to familiar concepts are the point.
const QUESTIONS = [
  {
    n: "01",
    icon: "👥",
    q: "为谁 · 做什么",
    en: "WHO · WHAT",
    body: "为兴趣、社交、话题小组等社区提供协作系统。管理员运营社区、办活动、发激励、派任务并检查；成员参与打卡、做任务拿积分、兑换咖啡与周边奖品。",
    analogy: "≈ 社区版 Notion + 会员卡 + 积分商城",
  },
  {
    n: "02",
    icon: "✨",
    q: "为何 · 用 Cos72",
    en: "WHY",
    body: "低摩擦、开源。用 Reputation / NFT（跨社区通用的声誉）+ xPNTs（社区内的贡献记录）激活参与和贡献，让连接沉淀、社区可持续。",
    analogy: "参与留痕 · 贡献可信 · 荣誉带得走",
  },
  {
    n: "03",
    icon: "🧭",
    q: "如何 · 开始用",
    en: "HOW",
    body: "刷脸建账户（无需助记词、无需 Gas），选一个额度画像进入你的社区。跟着小J的漫画漫游，一步步上手每个功能。",
    analogy: "刷脸即用 · 跟着小J走",
  },
];

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg transition active:scale-95";
  const ghostBtn =
    "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-95";

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
          {/* Hero */}
          <div className="flex flex-col-reverse sm:flex-row items-center gap-8">
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Cos72 · <strong>Co</strong>operation <strong>S</strong>ystem
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight text-gray-900 dark:text-white">
                社区的共创系统，
                <br className="hidden sm:block" />
                一套系统，七十二变
              </h1>
              <p className="mt-4 text-base text-gray-600 dark:text-gray-300 max-w-xl mx-auto sm:mx-0">
                给你的兴趣小组配一套{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  Discord + 会员积分 + 兑换商城
                </span>{" "}
                —— 但{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  开源、免费、数据和积分都归社区自己
                </span>
                。
              </p>
              <div className="mt-6 flex flex-wrap gap-3 justify-center sm:justify-start">
                <button onClick={() => router.push("/auth/register")} className={primaryBtn}>
                  刷脸创建账户
                </button>
                <button onClick={() => router.push("/auth/login")} className={ghostBtn}>
                  登录
                </button>
                <a
                  href="https://tour.mushroom.cv"
                  target="_blank"
                  rel="noreferrer"
                  className={ghostBtn}
                >
                  跟小J逛一圈 →
                </a>
              </div>
            </div>
            <div className="shrink-0">
              <Image
                src="/xiaoj.png"
                alt="小J — 你的社区向导"
                width={190}
                height={380}
                priority
                className="drop-shadow-xl"
              />
            </div>
          </div>

          {/* The 3 questions */}
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {QUESTIONS.map(q => (
              <div
                key={q.n}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/50 p-5 backdrop-blur"
              >
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-2xl">{q.icon}</span>
                  <span className="text-xs font-mono text-gray-400">{q.n}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{q.q}</h3>
                <p className="text-[10px] tracking-widest text-gray-400">{q.en}</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{q.body}</p>
                <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {q.analogy}
                </p>
              </div>
            ))}
          </div>

          {/* Guardian tip (preserved) */}
          <div className="mt-10 max-w-2xl mx-auto rounded-lg bg-white/60 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              🛡️ 有人请你当 <span className="font-medium">守护人（guardian）</span>
              ？直接打开他发来的 链接 / 二维码，用 Face ID / 指纹签名即可 ——
              无需钱包、无需安装。提示：登录 iCloud（Apple） 或 Google（Android），让 passkey
              跨设备同步。
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
