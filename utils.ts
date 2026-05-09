import { AbiParameter, Address, encodeAbiParameters, encodeFunctionData, encodePacked, parseAbi } from "viem";
import { CALLTYPE, CallType } from "./types/calltype";
import { EXECTYPE, ExecType } from "./types/exectype";

export type Action = {
  target: Address,
  value: bigint,
  data: {
    abi: AbiParameter[],
    functionName: string,
    args?: unknown[],
  },
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const encodeSingle = ({ target, value, data }: Action) =>
  encodePacked(
    ["address", "uint256", "bytes"],
    [target, value, encodeFunctionData(data)],
  );

export const encodeBatch = (actions: Action[]) =>
  encodeAbiParameters(
    [{
      name: "batch",
      type: "tuple[]",
      components: [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "callData", type: "bytes" },
      ],
    }],
    [actions.map(
      ({ target, value, data }) =>
        ({ target, value, callData: encodeFunctionData(data) })
    )],
  );

export const encodeMode = (callType: CallType, execType: ExecType) =>
  encodePacked(
    ["bytes1", "bytes1", "bytes30"],
    [callType, execType, "0x000000000000000000000000000000000000000000000000000000000000"],
  );

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const encodeExecuteSingle = (action: Action, execType: ExecType = EXECTYPE.DEFAULT) =>
  encodeFunctionData({
    abi: parseAbi([
      "function execute(bytes32 mode, bytes calldata executionCalldata) external payable",
    ]),
    functionName: "execute",
    args: [
      encodeMode(CALLTYPE.SINGLE, execType),
      encodeSingle(action),
    ],
  });

export const encodeExecuteBatch = (actions: Action[], execType: ExecType = EXECTYPE.DEFAULT) =>
  encodeFunctionData({
    abi: parseAbi([
      "function execute(bytes32 mode, bytes calldata executionCalldata) external payable",
    ]),
    functionName: "execute",
    args: [
      encodeMode(CALLTYPE.BATCH, execType),
      encodeBatch(actions),
    ],
  });
