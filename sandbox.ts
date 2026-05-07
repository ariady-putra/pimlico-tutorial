import { encodeFunctionData, encodePacked } from "viem";
import CounterExecutorModule from "./ExecutorModule.json";

const counterExecutorModule = "0xc8d3c0F8CF4a8B992bb4393729e89040bD17738a";
console.log(
  encodePacked(
    ["address", "uint256", "bytes"],
    [counterExecutorModule, 0n, encodeFunctionData({
      abi: CounterExecutorModule.abi,
      functionName: "incrementCount",
    })],
  )
);
