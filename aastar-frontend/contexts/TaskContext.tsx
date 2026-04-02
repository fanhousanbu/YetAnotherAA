"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  type PublicClient,
  type WalletClient,
} from "viem";
import { TASK_ESCROW_ABI, ERC20_ABI } from "@/lib/contracts/task-escrow-abi";
import {
  TASK_ESCROW_ADDRESS,
  DEFAULT_REWARD_TOKEN,
  DEFAULT_REWARD_TOKEN_DECIMALS,
  DEFAULT_REWARD_TOKEN_SYMBOL,
  TASK_TYPE_LABELS,
  SUPPORTED_CHAIN,
  RPC_URL,
  isContractsConfigured,
} from "@/lib/contracts/task-config";
import {
  type Task,
  type ParsedTask,
  type CreateTaskForm,
  TaskStatus,
  TASK_STATUS_LABELS,
} from "@/lib/task-types";
import { getStoredAuth } from "@/lib/auth";

interface TaskContextType {
  // Data
  tasks: ParsedTask[];
  myTasks: ParsedTask[]; // tasks I created (community role)
  claimedTasks: ParsedTask[]; // tasks I accepted (taskor role)
  loading: boolean;
  error: string | null;
  contractConfigured: boolean;
  // Actions
  loadAllTasks: () => Promise<void>;
  loadMyTasks: (address: string) => Promise<void>;
  createTask: (form: CreateTaskForm, walletClient: WalletClient) => Promise<`0x${string}` | null>;
  acceptTask: (taskId: string, walletClient: WalletClient) => Promise<boolean>;
  submitWork: (taskId: string, evidenceUri: string, walletClient: WalletClient) => Promise<boolean>;
  approveWork: (taskId: string, walletClient: WalletClient) => Promise<boolean>;
  finalizeTask: (taskId: string, walletClient: WalletClient) => Promise<boolean>;
  cancelTask: (taskId: string, walletClient: WalletClient) => Promise<boolean>;
  // Helpers
  getTask: (taskId: string) => Promise<ParsedTask | null>;
  approveToken: (amount: bigint, walletClient: WalletClient) => Promise<boolean>;
  checkAllowance: (ownerAddress: string) => Promise<bigint>;
}

const TaskContext = createContext<TaskContextType | null>(null);

export function useTask(): TaskContextType {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTask must be used within TaskProvider");
  return ctx;
}

function parseTask(raw: Task): ParsedTask {
  const now = new Date();
  const deadline = new Date(Number(raw.deadline) * 1000);
  const challengeDeadline =
    raw.challengeDeadline > 0n
      ? new Date(Number(raw.challengeDeadline) * 1000)
      : null;

  const rewardFormatted = formatUnits(raw.reward, DEFAULT_REWARD_TOKEN_DECIMALS);
  const taskTypeLabel =
    TASK_TYPE_LABELS[raw.taskType] ?? raw.taskType.slice(0, 10);

  const canFinalize =
    raw.status === TaskStatus.Submitted &&
    challengeDeadline !== null &&
    now > challengeDeadline;

  return {
    taskId: raw.taskId,
    community: raw.community,
    taskor: raw.taskor,
    supplier: raw.supplier,
    token: raw.token,
    reward: raw.reward,
    rewardFormatted,
    supplierFee: raw.supplierFee,
    deadline,
    createdAt: new Date(Number(raw.createdAt) * 1000),
    challengeDeadline,
    status: raw.status,
    statusLabel: TASK_STATUS_LABELS[raw.status] ?? "Unknown",
    metadataUri: raw.metadataUri,
    evidenceUri: raw.evidenceUri,
    taskType: raw.taskType,
    taskTypeLabel,
    isExpired: now > deadline,
    canFinalize,
  };
}

function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: SUPPORTED_CHAIN,
    transport: http(RPC_URL),
  }) as PublicClient;
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [myTasks, setMyTasks] = useState<ParsedTask[]>([]);
  const [claimedTasks, setClaimedTasks] = useState<ParsedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contractConfigured = isContractsConfigured();

  const fetchTask = useCallback(
    async (client: PublicClient, taskId: `0x${string}`): Promise<ParsedTask | null> => {
      try {
        const raw = await client.readContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "getTask",
          args: [taskId],
        });
        return parseTask(raw as Task);
      } catch {
        return null;
      }
    },
    []
  );

  const loadAllTasks = useCallback(async () => {
    if (!contractConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const client = getPublicClient();
      // Fetch TaskCreated events from recent blocks
      const latestBlock = await client.getBlockNumber();
      const fromBlock = latestBlock > 50000n ? latestBlock - 50000n : 0n;
      const logs = await client.getLogs({
        address: TASK_ESCROW_ADDRESS,
        fromBlock,
        toBlock: "latest",
        // Filter by TaskCreated event topic
        // keccak256("TaskCreated(bytes32,address,address,uint256)")
        topics: [
          "0x9c8fd9df1dc7c1a1ce1c0fe3e8e8843b247e4cfbc4f6e06e2ab0e8b3c3cf7f92",
        ],
      } as Parameters<typeof client.getLogs>[0]);

      // taskId is the first indexed param (topics[1])
      const taskIds = logs
        .map((l) => l.topics[1] as `0x${string}` | undefined)
        .filter((id): id is `0x${string}` => !!id);
      const fetched = await Promise.all(taskIds.map((id) => fetchTask(client, id)));
      const valid = fetched.filter((t): t is ParsedTask => t !== null);
      setTasks(valid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [contractConfigured, fetchTask]);

  const loadMyTasks = useCallback(
    async (address: string) => {
      if (!contractConfigured) return;
      setLoading(true);
      setError(null);
      try {
        const client = getPublicClient();
        const addr = address as `0x${string}`;

        const [communityIds, taskorIds] = await Promise.all([
          client.readContract({
            address: TASK_ESCROW_ADDRESS,
            abi: TASK_ESCROW_ABI,
            functionName: "getTasksByCommunity",
            args: [addr],
          }),
          client.readContract({
            address: TASK_ESCROW_ADDRESS,
            abi: TASK_ESCROW_ABI,
            functionName: "getTasksByTaskor",
            args: [addr],
          }),
        ]);

        const [mine, claimed] = await Promise.all([
          Promise.all((communityIds as `0x${string}`[]).map((id) => fetchTask(client, id))),
          Promise.all((taskorIds as `0x${string}`[]).map((id) => fetchTask(client, id))),
        ]);

        setMyTasks(mine.filter((t): t is ParsedTask => t !== null));
        setClaimedTasks(claimed.filter((t): t is ParsedTask => t !== null));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load my tasks");
      } finally {
        setLoading(false);
      }
    },
    [contractConfigured, fetchTask]
  );

  const getTask = useCallback(
    async (taskId: string): Promise<ParsedTask | null> => {
      if (!contractConfigured) return null;
      const client = getPublicClient();
      return fetchTask(client, taskId as `0x${string}`);
    },
    [contractConfigured, fetchTask]
  );

  const checkAllowance = useCallback(async (ownerAddress: string): Promise<bigint> => {
    const client = getPublicClient();
    const allowance = await client.readContract({
      address: DEFAULT_REWARD_TOKEN,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [ownerAddress as `0x${string}`, TASK_ESCROW_ADDRESS],
    });
    return allowance as bigint;
  }, []);

  const approveToken = useCallback(
    async (amount: bigint, walletClient: WalletClient): Promise<boolean> => {
      const [address] = await walletClient.getAddresses();
      try {
        const hash = await walletClient.writeContract({
          address: DEFAULT_REWARD_TOKEN,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [TASK_ESCROW_ADDRESS, amount],
          account: address,
          chain: SUPPORTED_CHAIN,
        });
        const client = getPublicClient();
        await client.waitForTransactionReceipt({ hash });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const createTask = useCallback(
    async (form: CreateTaskForm, walletClient: WalletClient): Promise<`0x${string}` | null> => {
      const [address] = await walletClient.getAddresses();
      const reward = parseUnits(form.rewardAmount, DEFAULT_REWARD_TOKEN_DECIMALS);
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + form.deadlineDays * 86400
      );

      // Build metadataUri as inline JSON (MVP: no IPFS)
      const metadata = JSON.stringify({
        title: form.title,
        description: form.description,
        createdAt: Math.floor(Date.now() / 1000),
      });

      try {
        const hash = await walletClient.writeContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "createTask",
          args: [DEFAULT_REWARD_TOKEN, reward, deadline, metadata, form.taskType],
          account: address,
          chain: SUPPORTED_CHAIN,
        });

        const client = getPublicClient();
        const receipt = await client.waitForTransactionReceipt({ hash });

        // Extract taskId from TaskCreated event
        const log = receipt.logs.find(
          (l) => l.address.toLowerCase() === TASK_ESCROW_ADDRESS.toLowerCase()
        );
        if (log?.topics[1]) {
          return log.topics[1] as `0x${string}`;
        }
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const acceptTask = useCallback(
    async (taskId: string, walletClient: WalletClient): Promise<boolean> => {
      const [address] = await walletClient.getAddresses();
      try {
        const hash = await walletClient.writeContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "acceptTask",
          args: [taskId as `0x${string}`],
          account: address,
          chain: SUPPORTED_CHAIN,
        });
        const client = getPublicClient();
        await client.waitForTransactionReceipt({ hash });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const submitWork = useCallback(
    async (taskId: string, evidenceUri: string, walletClient: WalletClient): Promise<boolean> => {
      const [address] = await walletClient.getAddresses();
      try {
        const hash = await walletClient.writeContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "submitWork",
          args: [taskId as `0x${string}`, evidenceUri],
          account: address,
          chain: SUPPORTED_CHAIN,
        });
        const client = getPublicClient();
        await client.waitForTransactionReceipt({ hash });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const approveWork = useCallback(
    async (taskId: string, walletClient: WalletClient): Promise<boolean> => {
      const [address] = await walletClient.getAddresses();
      try {
        const hash = await walletClient.writeContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "approveWork",
          args: [taskId as `0x${string}`],
          account: address,
          chain: SUPPORTED_CHAIN,
        });
        const client = getPublicClient();
        await client.waitForTransactionReceipt({ hash });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const finalizeTask = useCallback(
    async (taskId: string, walletClient: WalletClient): Promise<boolean> => {
      const [address] = await walletClient.getAddresses();
      try {
        const hash = await walletClient.writeContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "finalizeTask",
          args: [taskId as `0x${string}`],
          account: address,
          chain: SUPPORTED_CHAIN,
        });
        const client = getPublicClient();
        await client.waitForTransactionReceipt({ hash });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const cancelTask = useCallback(
    async (taskId: string, walletClient: WalletClient): Promise<boolean> => {
      const [address] = await walletClient.getAddresses();
      try {
        const hash = await walletClient.writeContract({
          address: TASK_ESCROW_ADDRESS,
          abi: TASK_ESCROW_ABI,
          functionName: "cancelTask",
          args: [taskId as `0x${string}`],
          account: address,
          chain: SUPPORTED_CHAIN,
        });
        const client = getPublicClient();
        await client.waitForTransactionReceipt({ hash });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  // Auto-load tasks when context mounts
  useEffect(() => {
    if (contractConfigured) {
      loadAllTasks();
    }
  }, [contractConfigured, loadAllTasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        myTasks,
        claimedTasks,
        loading,
        error,
        contractConfigured,
        loadAllTasks,
        loadMyTasks,
        createTask,
        acceptTask,
        submitWork,
        approveWork,
        finalizeTask,
        cancelTask,
        getTask,
        approveToken,
        checkAllowance,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}
