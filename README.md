# Pimlico Tutorial Template

This is a repository containing a simple template for completing the [the Pimlico tutorials](https://docs.pimlico.io/references/permissionless/how-to/accounts/use-erc7579-account) that includes Typescript, viem, and permissionless.js

Create a `.env` file with the following format:

```env
NETWORK=sepolia-optimism
ADMIN=0xPrivateKey
ALCHEMY_RPC_URL=https://opt-sepolia.g.alchemy.com/v2/your_alchemy_api_key
PIMLICO_RPC_URL=https://api.pimlico.io/v2/11155420/rpc?apikey=your_pimlico_api_key
```

To set up the template, clone this repository, run install the dependencies, and run `pnpm dev`!

```bash
pnpm i
pnpm dev
```

If everything works correctly, you should see something like the following printed to the console.

```log
{ network: 'sepolia-optimism' }
{ owner: '0xOwnerAddress' }
Smart account address: https://sepolia-optimism.etherscan.io/address/0xSmartAccountAddress
Install module: https://sepolia-optimism.etherscan.io/tx/0xInstallModuleTxHash
{ installModuleStatus: 'success' }
{ isCounterExecutorModuleInstalled: true }
Increment count: https://sepolia-optimism.etherscan.io/tx/0xIncrementCountTxHash
{ incrementCountStatus: 'success' }
Batch increment count: https://sepolia-optimism.etherscan.io/tx/0xBatchIncrementCountTxHash
{ batchIncrementCountStatus: 'success' }
Execute increment count from executor: https://sepolia-optimism.etherscan.io/tx/0xExecuteIncrementCountFromExecutorTxHash
{ executeIncrementCountFromExecutorStatus: 'success' }
Batch execute increment count from executor: https://sepolia-optimism.etherscan.io/tx/0xBatchExecuteIncrementCountFromExecutorTxHash
{ batchExecuteIncrementCountFromExecutorStatus: 'success' }
{ account: '0xSmartAccountAddress', count: 8n }
```
