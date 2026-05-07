type Single = "0x00";
type Batch = "0x01";
export type CallType = Single | Batch;
export const CALLTYPE: { SINGLE: Single; BATCH: Batch; } = {
  SINGLE: "0x00",
  BATCH: "0x01",
};
