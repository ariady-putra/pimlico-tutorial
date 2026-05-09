// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";
import {CounterExecutorModule} from "../src/CounterExecutorModule.sol";

contract CounterExecutorModuleScript is Script {
    CounterExecutorModule public counter;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // counter = new CounterExecutorModule{salt: keccak256("ptDummyExecutorModule")}();
        counter = new CounterExecutorModule();

        vm.stopBroadcast();

        address counterAddress = address(counter);
        console.log("CounterExecutorModule deployed at", counterAddress);
        // CounterExecutorModule deployed at 0x5ca58926833Cca3b1C7cB708E43570302A4a0dA2
    }
}
