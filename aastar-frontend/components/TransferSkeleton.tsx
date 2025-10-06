export default function TransferSkeleton() {
  return (
    <div className="max-w-2xl px-3 py-4 mx-auto sm:px-4 sm:py-6 lg:px-8 animate-pulse">
      {/* Header - Desktop only */}
      <div className="hidden md:block mb-8">
        <div className="h-9 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-96"></div>
      </div>

      {/* Asset Selection */}
      <div className="mb-6">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-3"></div>
        <div className="h-14 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
      </div>

      {/* Account Balance */}
      <div className="p-4 mb-6 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div className="h-7 bg-gray-200 dark:bg-gray-600 rounded w-40"></div>
          </div>
          <div className="text-right">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-2 ml-auto"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-48 ml-auto"></div>
          </div>
        </div>
      </div>

      {/* Transfer Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 space-y-6">
          {/* Recipient */}
          <div>
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-40 mb-2"></div>
            <div className="h-14 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32"></div>
            </div>
            <div className="h-16 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
          </div>

          {/* Paymaster Option */}
          <div className="p-4 border border-purple-200 dark:border-purple-600 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <div className="flex items-start">
              <div className="w-4 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
              <div className="ml-3 flex-1">
                <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-56 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-12 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
            <div className="flex-1 h-12 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 mt-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <div className="flex">
          <div className="w-5 h-5 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="ml-3 flex-1">
            <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-4/5"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
