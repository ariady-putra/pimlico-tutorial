import "dotenv/config";
import { appendFileSync } from "fs";
import { toNexusSmartAccount, toSafeSmartAccount } from "permissionless/accounts";
import { Address, Chain, Hex, SignableMessage, TypedData, TypedDataDefinition, UnionPartialBy, createPublicClient, encodePacked, getContract, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { optimismSepolia, sepolia } from "viem/chains";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createBundlerClient, entryPoint07Abi, entryPoint07Address, toSmartAccount, UserOperation } from "viem/account-abstraction";
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
import { erc7579Actions } from "permissionless/actions/erc7579";

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

const getChain: Record<string, Chain> = {
  "sepolia": sepolia,
  "sepolia-optimism": optimismSepolia,
};
const chain = getChain[network];

export const publicClient = createPublicClient({
  chain,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

const entryPoint: { address: Address; version: "0.7"; } = {
  address: entryPoint07Address,
  version: "0.7",
}; // global entrypoint

const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint,
});

const owner = privateKeyToAccount(privateKey);
console.log({ owner });

// const account = await toSafeSmartAccount({
//   client: publicClient,
//   owners: [owner],
//   entryPoint,
//   version: "1.4.1",
//   safe4337ModuleAddress: "0x7579EE8307284F293B1927136486880611F20002",
//   erc7579LaunchpadAddress: "0x7579011aB74c46090561ea277Ba79D510c6C00ff",

//   attesters: ["0x000000333034E9f539ce08819E12c1b8Cb29084d"], // This address belongs to Rhinestone. By designating them as attesters, you authorize that only modules explicitly approved by Rhinestone can be installed on your safe.
//   attestersThreshold: 1,
// });
const account = await toNexusSmartAccount({
  client: publicClient,
  owners: [owner],
  version: "1.0.0",
});
console.log(`Smart account address: https://${process.env.NETWORK}.etherscan.io/address/${account.address}`);

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

// const ownableExecutorModule = "0x4Fd8d57b94966982B62e9588C27B4171B55E8354";
// const moduleData = encodePacked(["address"], [owner.address]);
// const userOpHash = await smartAccountClient.installModule({
//   type: "executor",
//   address: ownableExecutorModule,
//   context: moduleData,
// });
const counterExecutorModule = "0xc8d3c0F8CF4a8B992bb4393729e89040bD17738a";
const installData = "0x"; // encodePacked([], []);
const userOpHash = await smartAccountClient.installModule({
  type: "executor",
  address: counterExecutorModule,
  context: installData,
});

const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });

const { transactionHash } = (
  await pimlicoClient.request({
    method: "eth_getUserOperationByHash",
    params: [receipt.userOpHash],
  })
)!;
console.log(`Transaction hash: https://${process.env.NETWORK}.etherscan.io/tx/${transactionHash}`);

const { status } = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
console.log({ status });
