# Pimlico Tutorial Template

This is a repository containing a simple template for completing the [the Pimlico tutorials](https://docs.pimlico.io/references/permissionless/how-to/accounts/use-erc7579-account) that includes Typescript, viem, and permissionless.js

Create a `.env` file with the following format:

```env
NETWORK=sepolia-base
ADMIN=0xPrivateKey
EXPLORER=https://sepolia.basescan.org
ALCHEMY_RPC_URL=https://base-sepolia.g.alchemy.com/v2/your_alchemy_api_key
PIMLICO_RPC_URL=https://api.pimlico.io/v2/84532/rpc?apikey=your_pimlico_api_key
```

To set up the template, clone this repository, run install the dependencies, and run `pnpm dev`!

```bash
pnpm i
pnpm dev
```

If everything works correctly, you should see something like the following printed to the console.

```log
{ network: 'sepolia-base' }
{ owner: '0xOwnerAddress' }
Smart account address: https://sepolia.basescan.org/address/0xSmartAccountAddress
Incrementing count...
Increment count: https://sepolia.basescan.org/tx/0xIncrementCountTxHash
{ incrementCountStatus: 'success' }
Waiting for next block...
Batch increment count: https://sepolia.basescan.org/tx/0xBatchIncrementCountTxHash
{ batchIncrementCountStatus: 'success' }
Waiting for next block...
Executing from executor...
Execute increment count from executor: https://sepolia.basescan.org/tx/0xExecuteIncrementCountFromExecutorTxHash
{ executeIncrementCountFromExecutorStatus: 'success' }
Waiting for next block...
Batch execute increment count from executor: https://sepolia.basescan.org/tx/0xBatchExecuteIncrementCountFromExecutorTxHash
{ batchExecuteIncrementCountFromExecutorStatus: 'success' }
Waiting for next block...
{ account: '0xSmartAccountAddress', count: 8n }
```
