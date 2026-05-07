import { encodeAbiParameters, encodeFunctionData, encodePacked } from "viem";
import CounterExecutorModule from "./ExecutorModule.json";

const counterExecutorModule = "0xc8d3c0F8CF4a8B992bb4393729e89040bD17738a";

console.log(
  encodeAbiParameters(
    [{
      name: "batch",
      type: "tuple[]",
      components: [
        {
          name: "module",
          type: "address",
        },
        {
          name: "value",
          type: "uint256",
        },
        {
          name: "callData",
          type: "bytes",
        },
      ],
    }],
    [
      [
        {
          module: counterExecutorModule,
          value: 0n,
          callData: encodeFunctionData({
            abi: CounterExecutorModule.abi,
            functionName: "incrementCount",
          }),
        },
        {
          module: counterExecutorModule,
          value: 0n,
          callData: encodeFunctionData({
            abi: CounterExecutorModule.abi,
            functionName: "incrementCount",
          }),
        },
      ]
    ],
  )
);
