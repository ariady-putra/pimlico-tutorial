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
        // CounterExecutorModule deployed at 0x402A5947e74A234728fce825740D375Da4C80064
    }
}
