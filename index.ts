import { ethers, providers } from "ethers";
import {
  downloadContractsBlob,
  getSubgraphVaults,
  populateSubgraphVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

export const CHAIN_IDS = {
  arbitrumSepolia: 421614,
  sepolia: 11155111,
  optimismSepolia: 11155420
};

const SELECTED_CHAIN_ID = CHAIN_IDS.optimismSepolia;

export const USER_FAKER_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "0xc086edda021d9b90c09bd0092d47c36879c879fb",
  [CHAIN_IDS.optimismSepolia]: "0xbcf3095812b97b2e2cd1a1d03230b01dc326c047"
};

export const POOL_TOKEN_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "0xf401d1482dfaa89a050f111992a222e9ad123e14",
  [CHAIN_IDS.optimismSepolia]: "0xa6bff884a85306cd1ab61dc010e3dca94f39cbec"
};

export const TOKEN_FAUCET_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "0xf0b484d8110b2bc5eb82e998e96626560801db42",
  [CHAIN_IDS.optimismSepolia]: "0x8cfffffa42407db9dcb974c2c744425c3e58d832"
};

const provider = new providers.JsonRpcProvider(
  SELECTED_CHAIN_ID === CHAIN_IDS.optimismSepolia
    ? process.env.OPTIMISM_SEPOLIA_RPC_PROVIDER_URL
    : process.env.ARBITRUM_SEPOLIA_RPC_PROVIDER_URL
);

// !!!
// NOTE: Make sure to lowercase these addresses so they play nice with the subgraph:
// !!!
const SELECTED_VAULTS = {
  [CHAIN_IDS.arbitrumSepolia]: [
    // "0x3adaa1d4f23c82130e1681c2ca9b38f5fb9a0892", // DAI
    // "0xa723cf5d90c1a472c7de7285e5bd314aea107ede" // USDC
    "0xa5905161eab67b6a13104537a09a949ef043366e" // V2 Vault WETH
  ],
  [CHAIN_IDS.optimismSepolia]: [
    "0x0fa95bdc0d8c6e39be9bf0f003ab4fa2d8d7a2ab", // DAI
    "0xb7b84e913adfb1d92128a261c11ec6dbd1f2bb9c" // USDC
  ]
};

const getVaults = async (chainId: number) => {
  let vaults = await getSubgraphVaults(chainId);
  if (vaults.length === 0) {
    throw new Error("Claimer: No vaults found in subgraph");
  }

  // Page through and concat all accounts for all vaults
  vaults = await populateSubgraphVaultAccounts(chainId, vaults);

  return vaults;
};

export async function main() {
  console.log("*********** BATCH CREATE FAKE USERS ***********");
  console.log("");

  const userFakerAddress = USER_FAKER_ADDRESS[SELECTED_CHAIN_ID];
  console.log({ userFakerAddress });

  const tokenFaucetAddress = TOKEN_FAUCET_ADDRESS[SELECTED_CHAIN_ID];
  console.log({ tokenFaucetAddress });

  const poolTokenAddress = POOL_TOKEN_ADDRESS[SELECTED_CHAIN_ID];
  console.log({ poolTokenAddress });
  console.log("");

  const privateKey = process.env.PRIVATE_KEY;
  const signer = new ethers.Wallet(privateKey, provider);

  // await drip(signer, tokenFaucetAddress, poolTokenAddress);

  const userFaker = new ethers.Contract(userFakerAddress, userFakerAbi, signer);

  // let vaults: any = await getVaults(SELECTED_CHAIN_ID);
  let vaults: any = [];

  if (vaults.length === 0) {
    vaults = [
      { id: SELECTED_VAULTS[SELECTED_CHAIN_ID][0], accounts: [] },
      { id: SELECTED_VAULTS[SELECTED_CHAIN_ID][1], accounts: [] }
    ];
  }
  console.log(vaults);

  for (let i = 0; i < vaults.length; i++) {
    try {
      const vault = vaults[i];

      // if (!SELECTED_VAULTS[SELECTED_CHAIN_ID].includes(vault.id)) {
      //   console.log("skipping");
      //   continue;
      // }

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(8, 20);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        Math.max(numUsers, 1),
        tokenFaucetAddress,
        { gasLimit: 10000000 }
      );
      console.log("TransactionHash:", transactionSentToNetwork.hash);
      await transactionSentToNetwork.wait();

      console.log("");
    } catch (error) {
      throw new Error(error);
    }
  }
}

main();

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  const int = Math.floor(Math.random() * (max - min + 1)) + min;
  return int === 0 ? 1 : int;
}

// Faucet
async function drip(signer, tokenFaucetAddress, tokenAddress) {
  console.log("drip");
  const contracts = await downloadContractsBlob(SELECTED_CHAIN_ID);

  const faucetContractData = contracts.contracts.find(contract => contract.type === "TokenFaucet");
  const faucetContract = new ethers.Contract(tokenFaucetAddress, faucetContractData?.abi, signer);

  const tx = await faucetContract.drip(tokenAddress);
  console.log("tx");
  console.log(tx.hash);
  console.log("");
}
