'use client';

import { User, Transfer } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/storage';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle } from 'lucide-react';

interface TransferHistoryProps {
  transfers: Transfer[];
  user: User;
}

export default function TransferHistory({ transfers, user }: TransferHistoryProps) {
  const getStatusIcon = (status: Transfer['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: Transfer['status']) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'pending':
        return '处理中';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const getTransferType = (transfer: Transfer) => {
    // 由于用户对象现在没有 walletAddress，我们需要从其他地方获取
    // 暂时使用一个简单的判断逻辑
    return transfer.fromAddress.toLowerCase() === transfer.toAddress.toLowerCase() ? 'outgoing' : 'incoming';
  };

  const getTransferDescription = (transfer: Transfer) => {
    // 暂时使用简单的描述
    return `转账 ${transfer.amount} ETH`;
  };

  if (transfers.length === 0) {
    return (
      <div className="card text-center py-12">
        <ArrowUpRight className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无转账记录</h3>
        <p className="text-gray-500">您的转账记录将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transfers.map((transfer) => {
        const isOutgoing = getTransferType(transfer) === 'outgoing';
        
        return (
          <div key={transfer.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isOutgoing ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  {isOutgoing ? (
                    <ArrowUpRight className="h-5 w-5 text-red-600" />
                  ) : (
                    <ArrowDownLeft className="h-5 w-5 text-green-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {getTransferDescription(transfer)}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {formatDate(transfer.createdAt)}
                  </p>
                  {transfer.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {transfer.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-lg font-semibold ${
                  isOutgoing ? 'text-red-600' : 'text-green-600'
                }`}>
                  {isOutgoing ? '-' : '+'}{formatCurrency(transfer.amount)}
                </div>
                <div className="flex items-center space-x-1 mt-1">
                  {getStatusIcon(transfer.status)}
                  <span className="text-xs text-gray-500">
                    {getStatusText(transfer.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
} 