import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

export const sepoliaPublicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

