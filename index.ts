import "dotenv/config";
import { appendFileSync } from "fs";
import { getMEEVersion, MEEVersion, toNexusAccount } from "@biconomy/abstractjs";
import { toNexusSmartAccount, toSafeSmartAccount } from "permissionless/accounts";
import { Address, BlockNumber, Chain, Hex, SignableMessage, TypedData, TypedDataDefinition, UnionPartialBy, createPublicClient, encodeAbiParameters, encodePacked, getContract, http, keccak256, toHex, walletActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia, optimismSepolia, sepolia } from "viem/chains";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createBundlerClient, entryPoint07Abi, entryPoint07Address, SmartAccount, toSmartAccount, UserOperation } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";

import {
  getAddress,
  maxUint256,
  parseAbi,
} from "viem";
import {
  EntryPointVersion,
} from "viem/account-abstraction";

import { encodeFunctionData, parseAbiItem } from "viem";
import { erc7579Actions, InstallModuleParameters } from "permissionless/actions/erc7579";
import { Action, encodeBatch, encodeExecuteBatch, encodeExecuteSingle, encodeMode, encodeSingle } from "./utils";
import { CALLTYPE } from "./types/calltype";
import { EXECTYPE } from "./types/exectype";
import CounterExecutorModuleJSON from "./onchain/out/CounterExecutorModule.sol/CounterExecutorModule.json";
import assert from "assert";

const adminPK = process.env.ADMIN;
if (!adminPK) throw new Error("Missing ADMIN");

const network = process.env.NETWORK;
if (!network) throw new Error("Missing NETWORK");
console.log({ network });

const explorer = process.env.EXPLORER;
if (!explorer) throw new Error("Missing EXPLORER");

const pimlicoUrl = process.env.PIMLICO_RPC_URL;
if (!pimlicoUrl) throw new Error("Missing PIMLICO_RPC_URL");

const privateKey =
  (process.env.PRIVATE_KEY as Hex) ??
  (() => {
    const pk = generatePrivateKey();
    // appendFileSync(".env", `\nPRIVATE_KEY=${pk}\n`);
    return pk;
  })();

const chainOf: Record<string, Chain> = {
  "sepolia": sepolia,
  "sepolia-base": baseSepolia,
  "sepolia-optimism": optimismSepolia,
};
const chain = chainOf[network];

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.ALCHEMY_RPC_URL),
}).extend(walletActions);

const entryPoint: { address: Address; version: "0.7"; } = {
  address: entryPoint07Address,
  version: "0.7",
}; // global entrypoint

const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint,
});

const owner = privateKeyToAccount(privateKey);
console.log({ owner: owner.address });

const counterExecutorModule: InstallModuleParameters<SmartAccount> = {
  type: "executor",
  address: "0x6f77567101a95077E14e5E6eAB27214B6a9B556F",
  context: owner.address as Hex,
};

// const account = await toNexusSmartAccount({
//   client: publicClient,
//   owners: [owner],
//   version: "1.0.0",
// });
const account = await toNexusAccount({
  signer: owner,
  chainConfiguration: {
    chain,
    transport: http(process.env.ALCHEMY_RPC_URL),
    version: getMEEVersion(MEEVersion.V3_0_0),
  },
  executors: [{
    module: counterExecutorModule.address,
    data: counterExecutorModule.context,
  }],
});
console.log(`Smart account address: ${explorer}/address/${account.address}`);

const smartAccountClient = createSmartAccountClient({
  account,
  chain,
  bundlerTransport: http(pimlicoUrl),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () =>
      (await pimlicoClient.getUserOperationGasPrice()).fast
  },
}).extend(
  erc7579Actions()
);

const waitForNextBlock = (currentBlock: BlockNumber) =>
  new Promise<BlockNumber>(
    (resolve) => {
      console.log("Waiting for next block...");
      const unwatch = publicClient.watchBlockNumber({
        onBlockNumber(blockNumber) {
          if (blockNumber > currentBlock) {
            unwatch();
            resolve(blockNumber);
          }
        },
      });
    }
  );

//////////////////////
//                  //
//  INSTALL MODULE  //
//                  //
//////////////////////

const CounterExecutor = {
  ...CounterExecutorModuleJSON,
  module: counterExecutorModule,
};

// // const ownableExecutorModule = "0x4Fd8d57b94966982B62e9588C27B4171B55E8354";
// // const moduleData = encodePacked(["address"], [owner.address]);
// // const installModuleOpHash = await smartAccountClient.installModule({
// //   type: "executor",
// //   address: ownableExecutorModule,
// //   context: moduleData,
// // });

// const installModuleOpHash = await smartAccountClient.installModule(CounterExecutor.module);
// const installModuleReceipt = await pimlicoClient.waitForUserOperationReceipt({
//   hash: installModuleOpHash,
// });

// const { transactionHash: installModuleTxHash } = (
//   await pimlicoClient.request({
//     method: "eth_getUserOperationByHash",
//     params: [installModuleReceipt.userOpHash],
//   })
// )!;
// console.log(`Install module: ${explorer}/${installModuleTxHash}`);

// const { status: installModuleStatus } = await publicClient.waitForTransactionReceipt({
//   hash: installModuleTxHash,
// });
// console.log({ installModuleStatus });

// const isCounterExecutorModuleInstalled = await smartAccountClient.isModuleInstalled(CounterExecutor.module);
// console.log({ isCounterExecutorModuleInstalled });

async function assertAccountModuleState() {
  assert(
    await account.isDeployed(),
    "Expected account to be deployed",
  );
  assert(
    await smartAccountClient.isModuleInstalled(CounterExecutor.module),
    "Expected module to be installed",
  );
}

///////////////////////
//                   //
//  INCREMENT COUNT  //
//                   //
///////////////////////

const incrementCount: Action = {
  target: CounterExecutor.module.address,
  value: 0n,
  data: {
    abi: CounterExecutor.abi,
    functionName: "incrementCount",
  },
};
console.log("Incrementing count...");

//////////////////////
//                  //
//  EXECUTE SINGLE  //
//                  //
//////////////////////

const incrementCountTxHash = await smartAccountClient.sendTransaction({
  callData: encodeExecuteSingle(incrementCount),
});
console.log(`Increment count: ${explorer}/tx/${incrementCountTxHash}`);

const incrementCountReceipt = await publicClient.waitForTransactionReceipt({
  hash: incrementCountTxHash,
});
console.log({ incrementCountStatus: incrementCountReceipt.status });

await waitForNextBlock(incrementCountReceipt.blockNumber);
await assertAccountModuleState();

/////////////////////
//                 //
//  EXECUTE BATCH  //
//                 //
/////////////////////

const batchIncrementCountTxHash = await smartAccountClient.sendTransaction({
  callData: encodeExecuteBatch([incrementCount, incrementCount, incrementCount]),
});
console.log(`Batch increment count: ${explorer}/tx/${batchIncrementCountTxHash}`);

const batchIncrementCountReceipt = await publicClient.waitForTransactionReceipt({
  hash: batchIncrementCountTxHash,
});
console.log({ batchIncrementCountStatus: batchIncrementCountReceipt.status });

await waitForNextBlock(batchIncrementCountReceipt.blockNumber);
await assertAccountModuleState();

/////////////////////////////
//                         //
//  EXECUTE FROM EXECUTOR  //
//                         //
/////////////////////////////

const admin = privateKeyToAccount(adminPK as Hex);

const defaultSingle = encodeMode(CALLTYPE.SINGLE, EXECTYPE.DEFAULT);
const defaultBatch = encodeMode(CALLTYPE.BATCH, EXECTYPE.DEFAULT);

console.log("Executing from executor...");

////////////////////////////////////
//                                //
//  EXECUTE SINGLE FROM EXECUTOR  //
//                                //
////////////////////////////////////

const executeIncrementCountFromExecutorArgs = {
  account: account.address,
  salt: await publicClient.readContract({
    address: CounterExecutor.module.address,
    abi: CounterExecutor.abi,
    functionName: "getSalt",
    args: [owner.address],
  }) as Hex,
  mode: defaultSingle,
  module: CounterExecutor.module.address,
  action: encodeSingle(incrementCount),
  signature: "0x" as Hex,
};

const executeIncrementCountFromExecutorMessage = encodePacked(
  ["address", "bytes32", "bytes32", "address", "bytes"],
  [
    executeIncrementCountFromExecutorArgs.account,
    executeIncrementCountFromExecutorArgs.salt,
    executeIncrementCountFromExecutorArgs.mode,
    executeIncrementCountFromExecutorArgs.module,
    executeIncrementCountFromExecutorArgs.action,
  ],
);

executeIncrementCountFromExecutorArgs.signature = await owner.signMessage({
  message: {
    raw: keccak256(executeIncrementCountFromExecutorMessage),
  },
});

const { request: executeIncrementCountFromExecutor } = await publicClient.simulateContract({
  address: CounterExecutor.module.address,
  abi: CounterExecutor.abi,
  functionName: "execute",
  args: [
    executeIncrementCountFromExecutorArgs.account,
    executeIncrementCountFromExecutorArgs.salt,
    executeIncrementCountFromExecutorArgs.mode,
    encodePacked(
      ["bytes", "bytes"],
      [
        executeIncrementCountFromExecutorArgs.signature,
        executeIncrementCountFromExecutorArgs.action,
      ],
    ),
  ],
  account: admin,
  nonce: await publicClient.getTransactionCount({
    address: admin.address,
    blockTag: "pending",
  }),
});
const executeIncrementCountFromExecutorTxHash = await publicClient.writeContract(executeIncrementCountFromExecutor);
console.log(`Execute increment count from executor: ${explorer}/tx/${executeIncrementCountFromExecutorTxHash}`);

const executeIncrementCountFromExecutorReceipt = await publicClient.waitForTransactionReceipt({
  hash: executeIncrementCountFromExecutorTxHash,
});
console.log({ executeIncrementCountFromExecutorStatus: executeIncrementCountFromExecutorReceipt.status });

await waitForNextBlock(executeIncrementCountFromExecutorReceipt.blockNumber);

///////////////////////////////////
//                               //
//  EXECUTE BATCH FROM EXECUTOR  //
//                               //
///////////////////////////////////

const batchExecuteIncrementCountFromExecutorArgs = {
  account: account.address,
  salt: await publicClient.readContract({
    address: CounterExecutor.module.address,
    abi: CounterExecutor.abi,
    functionName: "getSalt",
    args: [owner.address],
  }) as Hex,
  mode: defaultBatch,
  module: CounterExecutor.module.address,
  action: encodeBatch([incrementCount, incrementCount, incrementCount]),
  signature: "0x" as Hex,
};

const batchExecuteIncrementCountFromExecutorMessage = encodePacked(
  ["address", "bytes32", "bytes32", "address", "bytes"],
  [
    batchExecuteIncrementCountFromExecutorArgs.account,
    batchExecuteIncrementCountFromExecutorArgs.salt,
    batchExecuteIncrementCountFromExecutorArgs.mode,
    batchExecuteIncrementCountFromExecutorArgs.module,
    batchExecuteIncrementCountFromExecutorArgs.action,
  ],
);

batchExecuteIncrementCountFromExecutorArgs.signature = await owner.signMessage({
  message: {
    raw: keccak256(batchExecuteIncrementCountFromExecutorMessage),
  },
});

const { request: batchExecuteIncrementCountFromExecutor } = await publicClient.simulateContract({
  address: CounterExecutor.module.address,
  abi: CounterExecutor.abi,
  functionName: "execute",
  args: [
    batchExecuteIncrementCountFromExecutorArgs.account,
    batchExecuteIncrementCountFromExecutorArgs.salt,
    batchExecuteIncrementCountFromExecutorArgs.mode,
    encodePacked(
      ["bytes", "bytes"],
      [
        batchExecuteIncrementCountFromExecutorArgs.signature,
        batchExecuteIncrementCountFromExecutorArgs.action,
      ],
    ),
  ],
  account: admin,
  nonce: await publicClient.getTransactionCount({
    address: admin.address,
    blockTag: "pending",
  }),
});
const batchExecuteIncrementCountFromExecutorTxHash = await publicClient.writeContract(batchExecuteIncrementCountFromExecutor);
console.log(`Batch execute increment count from executor: ${explorer}/tx/${batchExecuteIncrementCountFromExecutorTxHash}`);

const batchExecuteIncrementCountFromExecutorReceipt = await publicClient.waitForTransactionReceipt({
  hash: batchExecuteIncrementCountFromExecutorTxHash,
});
console.log({ batchExecuteIncrementCountFromExecutorStatus: batchExecuteIncrementCountFromExecutorReceipt.status });

await waitForNextBlock(batchExecuteIncrementCountFromExecutorReceipt.blockNumber);

/////////////////
//             //
//  GET COUNT  //
//             //
/////////////////

const count = await publicClient.readContract({
  address: CounterExecutor.module.address,
  abi: CounterExecutor.abi,
  functionName: "getCount",
  account,
});
console.log({ account: account.address, count });

const expectedCount = 8n;
assert(
  count === expectedCount,
  `Expected count to be ${expectedCount}`,
);

// ////////////////////////
// //                    //
// //  UNINSTALL MODULE  //
// //                    //
// ////////////////////////

// const uninstallModuleOpHash = await smartAccountClient.uninstallModule(CounterExecutor.module);
// const uninstallModuleReceipt = await pimlicoClient.waitForUserOperationReceipt({
//   hash: uninstallModuleOpHash,
// });

// const { transactionHash: uninstallModuleTxHash } = (
//   await pimlicoClient.request({
//     method: "eth_getUserOperationByHash",
//     params: [uninstallModuleReceipt.userOpHash],
//   })
// )!;
// console.log(`Uninstall module: ${explorer}/tx/${uninstallModuleTxHash}`);

// const { status: uninstallModuleStatus } = await publicClient.waitForTransactionReceipt({
//   hash: uninstallModuleTxHash,
// });
// console.log({ uninstallModuleStatus });

// assert(
//   !(await smartAccountClient.isModuleInstalled(CounterExecutor.module)),
//   "Expected module to be not installed",
// );
