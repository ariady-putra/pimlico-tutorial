// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC7579Executor} from "@openzeppelin/community-contracts/account/modules/ERC7579Executor.sol";
import {IERC7579Module} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract CounterExecutorModule is ERC7579Executor {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address private immutable _SELF = address(this);

    //      Owner      Salt
    mapping(address => bytes32) private _salts;

    //      Owner              Account    Installed
    mapping(address => mapping(address => bool)) private _accounts;

    //      Account    Count
    mapping(address => uint256) private _counts;

    event ERC7579ExecutorModuleInstalled(address indexed module, address account);
    event ERC7579ExecutorModuleUninstalled(address indexed module, address account);

    error InvalidInstallData();
    error InvalidUninstallData();
    error InvalidSignature();
    error InvalidSigner();
    error InvalidSalt();
    error Unauthorized();

    function _onlyAccountOwner(address account) private view {
        address owner = msg.sender;
        if (!_accounts[owner][account]) revert Unauthorized();
    }

    modifier onlyAccountOwner(address account) {
        _onlyAccountOwner(account);
        _;
    }

    function getCount() public view returns (uint256) {
        return _counts[msg.sender];
    }

    function setCount(uint256 count) public {
        _counts[msg.sender] = count;
    }

    function resetCount() public {
        _counts[msg.sender] = 0;
    }

    function incrementCount() public returns (uint256) {
        return _counts[msg.sender]++;
    }

    function decrementCount() public returns (uint256) {
        return _counts[msg.sender]--;
    }

    function _initSalt(address owner) private {
        bytes memory salt = abi.encodePacked(owner, block.timestamp);
        _salts[owner] = keccak256(salt);
    }

    function _nextSalt(address owner) private {
        bytes memory salt = abi.encodePacked(owner, _salts[owner]);
        _salts[owner] = keccak256(salt);
    }

    function getSalt(address owner) public view returns (bytes32) {
        return _salts[owner];
    }

    /// @inheritdoc ERC7579Executor
    function _validateExecution(address account, bytes32 salt, bytes32 mode, bytes calldata data)
        internal
        virtual
        override
        // onlyAccountOwner(account)
        returns (bytes calldata)
    {
        bytes calldata signature = data[:65];
        bytes calldata callData = data[65:];

        bytes memory message = abi.encodePacked(account, salt, mode, _SELF, callData);
        bytes32 digest = keccak256(message).toEthSignedMessageHash();

        (address owner, ECDSA.RecoverError err,) = digest.tryRecoverCalldata(signature);
        if (err != ECDSA.RecoverError.NoError) revert InvalidSignature();
        // if (recovered != msg.sender) revert InvalidSigner();
        if (!_accounts[owner][account]) revert InvalidSigner();
        if (getSalt(owner) != salt) revert InvalidSalt();

        _nextSalt(owner);

        return callData;
    }

    /// @inheritdoc IERC7579Module
    function onInstall(bytes calldata data) external {
        if (data.length != 20) revert InvalidInstallData();

        address owner = address(bytes20(data[:20]));
        address account = msg.sender;

        _accounts[owner][account] = true;
        _initSalt(owner);

        emit ERC7579ExecutorModuleInstalled(_SELF, msg.sender);
    }

    /// @inheritdoc IERC7579Module
    function onUninstall(bytes calldata data) external {
        address owner = address(bytes20(data[:20]));
        address account = msg.sender;

        if (!_accounts[owner][account]) revert InvalidUninstallData();

        resetCount();

        delete _accounts[owner][account];

        emit ERC7579ExecutorModuleUninstalled(_SELF, msg.sender);
    }
}
