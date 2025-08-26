'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { accountAPI, transferAPI, blsAPI } from '@/lib/api';
import { Account, BlsNode, GasEstimate } from '@/lib/types';
import toast from 'react-hot-toast';
import {
  ArrowUpIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function TransferPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [nodes, setNodes] = useState<BlsNode[]>([]);
  const [formData, setFormData] = useState({
    to: '',
    amount: '',
    nodeIndices: [1, 2, 3],
  });
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [loading, setLoading] = useState({
    page: true,
    estimate: false,
    transfer: false,
  });
  const [transferResult, setTransferResult] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadPageData();
  }, []);

  const loadPageData = async () => {
    setLoading(prev => ({ ...prev, page: true }));
    try {
      // Load account
      const accountResponse = await accountAPI.getAccount();
      setAccount(accountResponse.data);

      // Load BLS nodes
      const nodesResponse = await blsAPI.getNodes();
      setNodes(nodesResponse.data);

      if (!accountResponse.data.deployed) {
        toast.error('Account must be deployed before making transfers');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to load account data';
      toast.error(message);
      router.push('/dashboard');
    } finally {
      setLoading(prev => ({ ...prev, page: false }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear gas estimate when form changes
    if (gasEstimate) {
      setGasEstimate(null);
    }
  };

  const handleNodeChange = (nodeIndex: number) => {
    setFormData(prev => ({
      ...prev,
      nodeIndices: prev.nodeIndices.includes(nodeIndex)
        ? prev.nodeIndices.filter(idx => idx !== nodeIndex)
        : [...prev.nodeIndices, nodeIndex],
    }));
    
    // Clear gas estimate when node selection changes
    if (gasEstimate) {
      setGasEstimate(null);
    }
  };

  const estimateGas = async () => {
    if (!formData.to || !formData.amount) {
      toast.error('Please fill in recipient address and amount');
      return;
    }

    setLoading(prev => ({ ...prev, estimate: true }));
    try {
      const response = await transferAPI.estimate({
        to: formData.to,
        amount: formData.amount,
        nodeIndices: formData.nodeIndices,
      });
      setGasEstimate(response.data);
      toast.success('Gas estimated successfully');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to estimate gas';
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, estimate: false }));
    }
  };

  const executeTransfer = async () => {
    if (!formData.to || !formData.amount) {
      toast.error('Please fill in recipient address and amount');
      return;
    }

    if (formData.nodeIndices.length < 3) {
      toast.error('Please select at least 3 nodes for BLS signature');
      return;
    }

    setLoading(prev => ({ ...prev, transfer: true }));
    try {
      const response = await transferAPI.execute({
        to: formData.to,
        amount: formData.amount,
        nodeIndices: formData.nodeIndices,
      });
      
      setTransferResult(response.data);
      toast.success('Transfer submitted successfully!');
      
      // Clear form
      setFormData({
        to: '',
        amount: '',
        nodeIndices: [1, 2, 3],
      });
      setGasEstimate(null);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Transfer failed';
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, transfer: false }));
    }
  };

  const formatGwei = (wei: string) => {
    return (parseInt(wei, 16) / 1e9).toFixed(2);
  };

  if (loading.page) {
    return (
      <Layout requireAuth={true}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (!account?.deployed) {
    return (
      <Layout requireAuth={true}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <InformationCircleIcon className="mx-auto h-12 w-12 text-yellow-400" />
            <h2 className="mt-2 text-lg font-medium text-gray-900">
              Account Not Deployed
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Your smart account needs to be deployed before you can make transfers.
            </p>
            <div className="mt-6">
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth={true}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <ArrowUpIcon className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Send Transfer</h1>
              <p className="text-sm text-gray-600">
                Send ETH using ERC-4337 account abstraction
              </p>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Your Balance</p>
              <p className="text-lg font-semibold text-blue-900">
                {account?.balance || '0'} ETH
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Account Address</p>
              <p className="text-sm font-mono text-blue-900">
                {account?.address.slice(0, 10)}...{account?.address.slice(-8)}
              </p>
            </div>
          </div>
        </div>

        {/* Transfer Result */}
        {transferResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Transfer Submitted Successfully!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Transfer ID: {transferResult.transferId}</p>
                  {transferResult.transactionHash && (
                    <p>Transaction: {transferResult.transactionHash.slice(0, 20)}...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Form */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="p-6 space-y-6">
            {/* Recipient */}
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-gray-700">
                Recipient Address
              </label>
              <input
                type="text"
                name="to"
                id="to"
                value={formData.to}
                onChange={handleChange}
                placeholder="0x..."
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount (ETH)
              </label>
              <input
                type="number"
                name="amount"
                id="amount"
                step="0.001"
                min="0"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.001"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {/* BLS Nodes Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                BLS Signature Nodes (Select at least 3)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {nodes.map((node) => (
                  <label key={node.index} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.nodeIndices.includes(node.index)}
                      onChange={() => handleNodeChange(node.index)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">
                      {node.nodeName}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Selected: {formData.nodeIndices.length} nodes
              </p>
            </div>

            {/* Gas Estimation */}
            {gasEstimate && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Gas Estimation
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Call Gas:</span>
                    <span className="ml-2 font-mono">
                      {parseInt(gasEstimate.callGasLimit, 16).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Verification Gas:</span>
                    <span className="ml-2 font-mono">
                      {parseInt(gasEstimate.verificationGasLimit, 16).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pre-verification:</span>
                    <span className="ml-2 font-mono">
                      {parseInt(gasEstimate.preVerificationGas, 16).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Max Fee:</span>
                    <span className="ml-2 font-mono">
                      {formatGwei(gasEstimate.maxFeePerGas)} Gwei
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={estimateGas}
                disabled={loading.estimate || !formData.to || !formData.amount}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.estimate ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                ) : null}
                Estimate Gas
              </button>
              
              <button
                type="button"
                onClick={executeTransfer}
                disabled={
                  loading.transfer || 
                  !formData.to || 
                  !formData.amount || 
                  formData.nodeIndices.length < 3
                }
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.transfer ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <ArrowUpIcon className="h-4 w-4 mr-2" />
                )}
                Send Transfer
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                How it works
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Select at least 3 BLS nodes for signature aggregation</li>
                  <li>Estimate gas costs before sending</li>
                  <li>Transaction uses ERC-4337 UserOperation</li>
                  <li>BLS signatures reduce verification costs</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}