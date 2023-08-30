import { ethers, providers } from "ethers";
import {
  downloadContractsBlob,
  getSubgraphVaults,
  populateSubgraphVaultAccounts
} from "@generationsoftware/pt-v5-utils-js";

import { userFakerAbi } from "./abis/userFakerAbi";

const CHAIN_ID = 420; // opt goerli
// const CHAIN_ID = 11155111; // sepolia

const USER_FAKER_ADDRESS = "0x7506De196cd50f95c53412844743c90B63fE79ef";
const TOKEN_FAUCET_ADDRESS = "0xc9f91F4aeee31A2a65eC142b2E6c1725Cd160De5";

//
// NOTE: Make sure to lowercase these addresses so they play nice with the subgraph:
//
const SELECTED_VAULTS = [
  "0x3bd1ca87f5d5c80b97d57825151715c204444c94", //DAI?
  "0xfef4a3fe03a480b1872ff0e95a30f0fa16db323d" // usdc
];

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

  console.log({ USER_FAKER_ADDRESS });
  console.log({ TOKEN_FAUCET_ADDRESS });
  console.log("");

  const provider = new providers.JsonRpcProvider(process.env.OPTIMISM_GOERLI_RPC_PROVIDER_URL);
  const privateKey = process.env.PRIVATE_KEY;
  const signer = new ethers.Wallet(privateKey, provider);

  // const tokenAddress = "0x20524C0a56ec85A1aF9b0989202C5bDc1B649Def"; // POOL
  // await drip(signer, tokenAddress);

  const userFaker = new ethers.Contract(USER_FAKER_ADDRESS, userFakerAbi, signer);

  let vaults: any = await getVaults(CHAIN_ID);
  // let vaults: any = [];

  if (vaults.length === 0) {
    vaults = [
      { id: SELECTED_VAULTS[0], accounts: [] },
      { id: SELECTED_VAULTS[1], accounts: [] }
    ];
  }

  for (let i = 0; i < vaults.length; i++) {
    try {
      const vault = vaults[i];

      if (!SELECTED_VAULTS.includes(vault.id)) {
        console.log("skipping");
        continue;
      }

      console.log("Vault ID:", vault.id);

      const vaultUserCount = vault.accounts.length;
      console.log("Existing vault depositors count:", vaultUserCount);

      const numToAdd = getRandomInt(15, 20);
      console.log("# of depositors to add:", numToAdd);

      const numUsers = vaultUserCount + numToAdd;
      console.log("# to set vault to:", numUsers);

      const transactionSentToNetwork = await userFaker.setFakeUsers(
        vault.id,
        numUsers,
        TOKEN_FAUCET_ADDRESS,
        { gasLimit: 10000000 }
      );
      await transactionSentToNetwork.wait();

      console.log("TransactionHash:", transactionSentToNetwork.hash);
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
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Faucet
async function drip(signer, tokenAddress) {
  console.log("drip");
  const contracts = await downloadContractsBlob(CHAIN_ID);

  const faucetContractData = contracts.contracts.find(contract => contract.type === "TokenFaucet");
  const faucetContract = new ethers.Contract(TOKEN_FAUCET_ADDRESS, faucetContractData?.abi, signer);

  const tx = await faucetContract.drip(tokenAddress);
  console.log("tx");
  console.log(tx.hash);
  console.log("");
}
