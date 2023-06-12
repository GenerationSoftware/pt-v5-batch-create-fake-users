export const userFakerAbi = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    inputs: [
      {
        internalType: "contract Vault[]",
        name: "_vaults",
        type: "address[]"
      },
      {
        internalType: "uint256",
        name: "_count",
        type: "uint256"
      },
      {
        internalType: "contract ITokenFaucet",
        name: "_tokenFaucet",
        type: "address"
      }
    ],
    name: "batchSetFakeUsers",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "contract Vault",
        name: "_vault",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_userIndex",
        type: "uint256"
      }
    ],
    name: "computeAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "contract Vault",
        name: "_vault",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_count",
        type: "uint256"
      },
      {
        internalType: "contract ITokenFaucet",
        name: "_tokenFaucet",
        type: "address"
      }
    ],
    name: "setFakeUsers",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];
