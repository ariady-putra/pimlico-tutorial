// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {VmSafe} from "forge-std/Script.sol";
import {Execution, MODULE_TYPE_EXECUTOR} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {
    ERC7579Utils,
    Mode,
    ModePayload,
    ModeSelector
} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MockSmartAccount} from "../test/mocks/MockSmartAccount.sol";
import {CounterExecutorModule} from "../src/CounterExecutorModule.sol";

contract CounterExecutorModuleTest is Test {
    using MessageHashUtils for bytes32;

    CounterExecutorModule public counter;

    function setUp() public {
        counter = new CounterExecutorModule();
        counter.resetCount();
    }

    function test_IncrementCount() public {
        counter.incrementCount();
        assertEq(counter.getCount(), 1);
    }

    function testFuzz_SetCount(uint256 x) public {
        counter.setCount(x);
        assertEq(counter.getCount(), x);
    }

    function testFuzz_InstallModule(address owner) public {
        address module = address(counter);
        bytes memory installData = abi.encodePacked(owner);

        MockSmartAccount account = new MockSmartAccount();
        account.initializeAccount(owner);

        address entryPoint = address(account.entryPoint());
        vm.prank(entryPoint);

        vm.expectEmit(true, false, false, true);
        emit CounterExecutorModule.ERC7579ExecutorModuleInstalled(module, address(account));

        account.installModule(MODULE_TYPE_EXECUTOR, module, installData);
    }

    function testFuzz_UninstallModule(address owner) public {
        address module = address(counter);
        bytes memory installData = abi.encodePacked(owner);

        MockSmartAccount account = new MockSmartAccount();
        account.initializeAccount(owner);

        address entryPoint = address(account.entryPoint());
        vm.prank(entryPoint);

        account.installModule(MODULE_TYPE_EXECUTOR, module, installData);

        vm.expectEmit(false, false, false, true);
        emit CounterExecutorModule.ERC7579ExecutorModuleUninstalled(module, address(account));

        vm.prank(entryPoint);
        account.uninstallModule(MODULE_TYPE_EXECUTOR, module, installData);
    }

    function testFuzz_ExecuteModule(uint64 pk) public {
        vm.warp(vm.unixTime());
        VmSafe.Wallet memory owner = vm.createWallet(uint256(2) * (uint128(1) + pk), "Owner");

        MockSmartAccount account = new MockSmartAccount();
        account.initializeAccount(owner.addr);

        address entryPoint = address(account.entryPoint());
        vm.prank(entryPoint);

        address module = address(counter);
        bytes memory installData = abi.encodePacked(owner.addr);
        account.installModule(MODULE_TYPE_EXECUTOR, module, installData);

        bytes32 mode = Mode.unwrap(
            ERC7579Utils.encodeMode(
                ERC7579Utils.CALLTYPE_SINGLE, ERC7579Utils.EXECTYPE_DEFAULT, ModeSelector.wrap(""), ModePayload.wrap("")
            )
        );
        uint256 value = 0;

        // execute incrementCount via UserOp:
        bytes memory incrementCount =
            abi.encodePacked(module, value, abi.encodeWithSelector(CounterExecutorModule.incrementCount.selector));
        vm.prank(entryPoint);
        account.execute(mode, incrementCount);

        vm.prank(address(account));
        assertEq(counter.getCount(), 1);

        // execute decrementCount from Executor:
        bytes memory decrementCount =
            abi.encodePacked(module, value, abi.encodeWithSelector(CounterExecutorModule.decrementCount.selector));
        bytes32 salt = counter.getSalt(owner.addr);
        bytes memory signature = _sign(owner, address(account), salt, mode, module, decrementCount);
        // vm.prank(owner.addr); // anyone with owner signature can execute
        counter.execute(address(account), salt, mode, abi.encodePacked(signature, decrementCount));

        vm.prank(address(account));
        assertEq(counter.getCount(), 0);
    }

    function testFuzz_ExecuteBatch(uint64 pk, uint8 executions) public {
        vm.warp(vm.unixTime());
        VmSafe.Wallet memory owner = vm.createWallet(uint256(2) * (uint128(1) + pk), "Owner");

        MockSmartAccount account = new MockSmartAccount();
        account.initializeAccount(owner.addr);

        address entryPoint = address(account.entryPoint());
        vm.prank(entryPoint);

        address module = address(counter);
        bytes memory installData = abi.encodePacked(owner.addr);
        account.installModule(MODULE_TYPE_EXECUTOR, module, installData);

        bytes32 mode = Mode.unwrap(
            ERC7579Utils.encodeMode(
                ERC7579Utils.CALLTYPE_BATCH, ERC7579Utils.EXECTYPE_DEFAULT, ModeSelector.wrap(""), ModePayload.wrap("")
            )
        );
        uint256 value = 0;

        // batch execute incrementCount via UserOp:
        Execution memory incrementCount = Execution({
            target: module,
            value: value,
            callData: abi.encodeWithSelector(CounterExecutorModule.incrementCount.selector)
        });
        Execution[] memory incrementCounts = new Execution[](executions);
        for (uint8 e = 0; e < executions; e++) {
            incrementCounts[e] = incrementCount;
        }
        bytes memory batchIncrementCounts = ERC7579Utils.encodeBatch(incrementCounts);
        vm.prank(entryPoint);
        account.execute(mode, batchIncrementCounts);

        vm.prank(address(account));
        assertEq(counter.getCount(), executions);

        // batch execute decrementCount from Executor:
        Execution memory decrementCount = Execution({
            target: module,
            value: value,
            callData: abi.encodeWithSelector(CounterExecutorModule.decrementCount.selector)
        });
        Execution[] memory decrementCounts = new Execution[](executions);
        for (uint8 e = 0; e < executions; e++) {
            decrementCounts[e] = decrementCount;
        }
        bytes memory batchDecrementCounts = ERC7579Utils.encodeBatch(decrementCounts);
        bytes32 salt = counter.getSalt(owner.addr);
        bytes memory signature = _sign(owner, address(account), salt, mode, module, batchDecrementCounts);
        // vm.prank(owner.addr); // anyone with owner signature can execute
        counter.execute(address(account), salt, mode, abi.encodePacked(signature, batchDecrementCounts));

        vm.prank(address(account));
        assertEq(counter.getCount(), 0);
    }

    function _sign(
        VmSafe.Wallet memory signer,
        address account,
        bytes32 salt,
        bytes32 mode,
        address module,
        bytes memory action
    ) private pure returns (bytes memory) {
        bytes memory message = abi.encodePacked(account, salt, mode, module, action);
        bytes32 digest = keccak256(message).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer, digest);
        return abi.encodePacked(r, s, v); // NOTE: The order here is different
    }
}
