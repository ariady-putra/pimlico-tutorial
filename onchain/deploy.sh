#!/bin/bash
source .env
forge script script/CounterExecutorModule.s.sol --broadcast --rpc-url $BASE_RPC_URL --account $ACCOUNT --verify --etherscan-api-key $ETHERSCAN_API_KEY
forge script script/CounterExecutorModule.s.sol --broadcast --rpc-url $OP_RPC_URL --account $ACCOUNT --verify --etherscan-api-key $ETHERSCAN_API_KEY
