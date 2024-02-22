import { ethers, providers } from "ethers";
import {
  downloadContractsBlob,
  getSubgraphPrizeVaults,
  populateSubgraphPrizeVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

export const CHAIN_IDS = {
  arbitrumSepolia: 421614,
  sepolia: 11155111,
  optimismGoerli: 420,
  optimismSepolia: 11155420
};

const SELECTED_CHAIN_ID = CHAIN_IDS.optimismGoerli;

export const USER_FAKER_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "0xc086edda021d9b90c09bd0092d47c36879c879fb",
  [CHAIN_IDS.optimismSepolia]: "0xbcf3095812b97b2e2cd1a1d03230b01dc326c047",
  [CHAIN_IDS.optimismGoerli]: "0x7506de196cd50f95c53412844743c90b63fe79ef"
};

export const POOL_TOKEN_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "0xf401d1482dfaa89a050f111992a222e9ad123e14",
  [CHAIN_IDS.optimismSepolia]: "0x7396655c4ac7d32aa458d837b2749cd4db762564",
  [CHAIN_IDS.optimismGoerli]: "0xde142f273ed15546f9c61fa1ad23c0bfbc6aa26e"
};

export const TOKEN_FAUCET_ADDRESS = {
  [CHAIN_IDS.arbitrumSepolia]: "0xf0b484d8110b2bc5eb82e998e96626560801db42",
  [CHAIN_IDS.optimismSepolia]: "0x6059cc0d895fd913811508d474192f6ff564dcf6",
  [CHAIN_IDS.optimismGoerli]: "0x3e4c05b244b95910cf8f17c51060797f2eecb3f7"
};

const provider = new providers.JsonRpcProvider(
  SELECTED_CHAIN_ID === CHAIN_IDS.optimismSepolia
    ? process.env.OPTIMISM_SEPOLIA_RPC_PROVIDER_URL
    : SELECTED_CHAIN_ID === CHAIN_IDS.optimismGoerli
    ? process.env.OPTIMISM_GOERLI_RPC_PROVIDER_URL
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
    "0x0ffe33d8b2d93ff1eff4be866c87ae45c22fb681", // DAI
    "0x170de99261a497d5b29aa2279cc2f3da0eb09b4b" // USDC
  ],
  [CHAIN_IDS.optimismGoerli]: [
    "0x9407700d80fd43b8e9741d0202786fd09e553fdd", // DAI
    "0x596845f8608d40c79d7608b72adf79e99e6b7422" // USDC
  ]
};

const getPrizeVaults = async (chainId: number) => {
  let prizeVaults = await getSubgraphPrizeVaults(chainId);
  if (prizeVaults.length === 0) {
    throw new Error("Claimer: No prizeVaults found in subgraph");
  }

  // Page through and concat all accounts for all prizeVaults
  prizeVaults = await populateSubgraphPrizeVaultAccounts(chainId, prizeVaults);

  return prizeVaults;
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

  let prizeVaults: any = await getPrizeVaults(SELECTED_CHAIN_ID);
  // let prizeVaults: any = [];

  if (prizeVaults.length === 0) {
    prizeVaults = [
      { id: SELECTED_VAULTS[SELECTED_CHAIN_ID][0], accounts: [] },
      { id: SELECTED_VAULTS[SELECTED_CHAIN_ID][1], accounts: [] }
    ];
  }

  for (let i = 0; i < prizeVaults.length; i++) {
    try {
      const vault = prizeVaults[i];

      if (!SELECTED_VAULTS[SELECTED_CHAIN_ID].includes(vault.id)) {
        console.log("skipping");
        continue;
      }

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(0, 20);
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
  // console.log(contracts);

  const faucetContractData = contracts.contracts.find(contract => contract.type === "TokenFaucet");
  // console.log(faucetContractData);
  const faucetContract = new ethers.Contract(tokenFaucetAddress, faucetContractData?.abi, signer);
  // console.log("faucetContract");
  // console.log(faucetContract);

  const tx = await faucetContract.drip(tokenAddress);
  console.log("tx");
  console.log(tx.hash);
  console.log("");
}
