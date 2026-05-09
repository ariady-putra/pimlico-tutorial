import "dotenv/config";
import { appendFileSync } from "fs";
import { toNexusSmartAccount, toSafeSmartAccount } from "permissionless/accounts";
import { Address, Chain, Hex, SignableMessage, TypedData, TypedDataDefinition, UnionPartialBy, createPublicClient, encodeAbiParameters, encodePacked, getContract, http, keccak256, toHex, walletActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { optimismSepolia, sepolia } from "viem/chains";
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
  "sepolia-optimism": optimismSepolia,
};
const chain = chainOf[network];

export const publicClient = createPublicClient({
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

// const account = await toSafeSmartAccount({
//   client: publicClient,
//   owners: [owner],
//   entryPoint,
//   version: "1.4.1",
//   safe4337ModuleAddress: "0x7579EE8307284F293B1927136486880611F20002",
//   erc7579LaunchpadAddress: "0x7579011aB74c46090561ea277Ba79D510c6C00ff",
//   // attesters: ["0x000000333034E9f539ce08819E12c1b8Cb29084d"], // This address belongs to Rhinestone. By designating them as attesters, you authorize that only modules explicitly approved by Rhinestone can be installed on your safe.
//   // attestersThreshold: 1,
// });
const account = await toNexusSmartAccount({
  client: publicClient,
  owners: [owner],
  version: "1.0.0",
});
console.log(`Smart account address: https://${network}.etherscan.io/address/${account.address}`);

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

//////////////////////
//                  //
//  INSTALL MODULE  //
//                  //
//////////////////////

const counterExecutorModule: InstallModuleParameters<SmartAccount> = {
  type: "executor",
  address: "0x00c4ed7f0a672F54601903dBdff34f42A84001c8",
  context: owner.address,
};

const CounterExecutor = {
  ...CounterExecutorModuleJSON,
  module: counterExecutorModule,
};

// const ownableExecutorModule = "0x4Fd8d57b94966982B62e9588C27B4171B55E8354";
// const moduleData = encodePacked(["address"], [owner.address]);
// const installModuleOpHash = await smartAccountClient.installModule({
//   type: "executor",
//   address: ownableExecutorModule,
//   context: moduleData,
// });

const installModuleOpHash = await smartAccountClient.installModule(CounterExecutor.module);
const installModuleReceipt = await pimlicoClient.waitForUserOperationReceipt({
  hash: installModuleOpHash,
});

const { transactionHash: installModuleTxHash } = (
  await pimlicoClient.request({
    method: "eth_getUserOperationByHash",
    params: [installModuleReceipt.userOpHash],
  })
)!;
console.log(`Install module: https://${network}.etherscan.io/tx/${installModuleTxHash}`);

const { status: installModuleStatus } = await publicClient.waitForTransactionReceipt({
  hash: installModuleTxHash,
});
console.log({ installModuleStatus });

const isCounterExecutorModuleInstalled = await smartAccountClient.isModuleInstalled(CounterExecutor.module);
console.log({ isCounterExecutorModuleInstalled });

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

//////////////////////
//                  //
//  EXECUTE SINGLE  //
//                  //
//////////////////////

const incrementCountTxHash = await smartAccountClient.sendTransaction({
  callData: encodeExecuteSingle(incrementCount),
});
console.log(`Increment count: https://${network}.etherscan.io/tx/${incrementCountTxHash}`);

const { status: incrementCountStatus } = await publicClient.waitForTransactionReceipt({
  hash: incrementCountTxHash,
});
console.log({ incrementCountStatus });

/////////////////////
//                 //
//  EXECUTE BATCH  //
//                 //
/////////////////////

const batchIncrementCountTxHash = await smartAccountClient.sendTransaction({
  callData: encodeExecuteBatch([incrementCount, incrementCount, incrementCount]),
});
console.log(`Batch increment count: https://${network}.etherscan.io/tx/${batchIncrementCountTxHash}`);

const { status: batchIncrementCountStatus } = await publicClient.waitForTransactionReceipt({
  hash: batchIncrementCountTxHash,
});
console.log({ batchIncrementCountStatus });

/////////////////////////////
//                         //
//  EXECUTE FROM EXECUTOR  //
//                         //
/////////////////////////////

const admin = privateKeyToAccount(adminPK as Hex);

const singleDefault = encodeMode(CALLTYPE.SINGLE, EXECTYPE.DEFAULT);
const batchDefault = encodeMode(CALLTYPE.BATCH, EXECTYPE.DEFAULT);

console.log("Wait 15 seconds...");

////////////////////////////////////
//                                //
//  EXECUTE SINGLE FROM EXECUTOR  //
//                                //
////////////////////////////////////

setTimeout(
  async () => {
    const executeIncrementCountFromExecutorArgs = {
      account: account.address,
      salt: await publicClient.readContract({
        address: CounterExecutor.module.address,
        abi: CounterExecutor.abi,
        functionName: "getSalt",
        args: [owner.address],
      }) as Hex,
      mode: singleDefault,
      module: CounterExecutor.module.address,
    };

    const executeIncrementCountFromExecutorMessage = encodePacked(
      ["address", "bytes32", "bytes32", "address"],
      [
        executeIncrementCountFromExecutorArgs.account,
        executeIncrementCountFromExecutorArgs.salt,
        executeIncrementCountFromExecutorArgs.mode,
        executeIncrementCountFromExecutorArgs.module,
      ],
    );

    const executeIncrementCountFromExecutorSignature = await owner.signMessage({
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
            executeIncrementCountFromExecutorSignature,
            encodeSingle(incrementCount),
          ],
        ),
      ],
      account: admin,
    });
    const executeIncrementCountFromExecutorTxHash = await publicClient.writeContract(executeIncrementCountFromExecutor);
    console.log(`Execute increment count from executor: https://${network}.etherscan.io/tx/${executeIncrementCountFromExecutorTxHash}`);

    const { status: executeIncrementCountFromExecutorStatus } = await publicClient.waitForTransactionReceipt({
      hash: executeIncrementCountFromExecutorTxHash,
    });
    console.log({ executeIncrementCountFromExecutorStatus });

    console.log("Wait 15 seconds...");
  },
  15_000,
);

///////////////////////////////////
//                               //
//  EXECUTE BATCH FROM EXECUTOR  //
//                               //
///////////////////////////////////

setTimeout(
  async () => {
    const batchExecuteIncrementCountFromExecutorArgs = {
      account: account.address,
      salt: await publicClient.readContract({
        address: CounterExecutor.module.address,
        abi: CounterExecutor.abi,
        functionName: "getSalt",
        args: [owner.address],
      }) as Hex,
      mode: batchDefault,
      module: CounterExecutor.module.address,
    };

    const batchExecuteIncrementCountFromExecutorMessage = encodePacked(
      ["address", "bytes32", "bytes32", "address"],
      [
        batchExecuteIncrementCountFromExecutorArgs.account,
        batchExecuteIncrementCountFromExecutorArgs.salt,
        batchExecuteIncrementCountFromExecutorArgs.mode,
        batchExecuteIncrementCountFromExecutorArgs.module,
      ],
    );

    const batchExecuteIncrementCountFromExecutorSignature = await owner.signMessage({
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
            batchExecuteIncrementCountFromExecutorSignature,
            encodeBatch([incrementCount, incrementCount, incrementCount]),
          ],
        ),
      ],
      account: admin,
    });
    const batchExecuteIncrementCountFromExecutorTxHash = await publicClient.writeContract(batchExecuteIncrementCountFromExecutor);
    console.log(`Batch execute increment count from executor: https://${network}.etherscan.io/tx/${batchExecuteIncrementCountFromExecutorTxHash}`);

    const { status: batchExecuteIncrementCountFromExecutorStatus } = await publicClient.waitForTransactionReceipt({
      hash: batchExecuteIncrementCountFromExecutorTxHash,
    });
    console.log({ batchExecuteIncrementCountFromExecutorStatus });

    console.log("Wait 15 seconds...");
  },
  30_000,
);

/////////////////
//             //
//  GET COUNT  //
//             //
/////////////////

setTimeout(
  async () => {
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
  },
  45_000,
);

// ////////////////////////
// //                    //
// //  UNINSTALL MODULE  //
// //                    //
// ////////////////////////

// setTimeout(
//   async () => {
//     const uninstallModuleOpHash = await smartAccountClient.uninstallModule(CounterExecutor.module);
//     const uninstallModuleReceipt = await pimlicoClient.waitForUserOperationReceipt({
//       hash: uninstallModuleOpHash,
//     });

//     const { transactionHash: uninstallModuleTxHash } = (
//       await pimlicoClient.request({
//         method: "eth_getUserOperationByHash",
//         params: [uninstallModuleReceipt.userOpHash],
//       })
//     )!;
//     console.log(`Uninstall module: https://${network}.etherscan.io/tx/${uninstallModuleTxHash}`);

//     const { status: uninstallModuleStatus } = await publicClient.waitForTransactionReceipt({
//       hash: uninstallModuleTxHash,
//     });
//     console.log({ uninstallModuleStatus });

//     assert(
//       !(await smartAccountClient.isModuleInstalled(CounterExecutor.module)),
//       "Expected module to be not installed",
//     );
//   },
//   60_000,
// );
