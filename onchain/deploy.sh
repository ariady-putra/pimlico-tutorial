#!/bin/bash
source .env
forge script script/CounterExecutorModule.s.sol --broadcast --rpc-url $RPC_URL --account $ACCOUNT --verify --etherscan-api-key $ETHERSCAN_API_KEY
