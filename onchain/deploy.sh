#!/bin/bash
source .env
forge script script/CounterExecutorModule.s.sol --broadcast --rpc-url $RPC_URL --account $ACCOUNT
