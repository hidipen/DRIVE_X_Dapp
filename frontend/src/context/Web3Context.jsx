import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import CarRentalABI from "../abi/CarRental.json";

const Web3Context = createContext(null);

const LOCALHOST_CHAIN_ID = 31337;

const EXPECTED_CHAIN_ID = Number(
  process.env.REACT_APP_CHAIN_ID ||
    CarRentalABI.chainId ||
    (CarRentalABI.network === "localhost" ? LOCALHOST_CHAIN_ID : 0)
);

const toChainIdHex = (id) => `0x${id.toString(16)}`;

const getNetworkLabel = (chainId) => {
  if (chainId === LOCALHOST_CHAIN_ID) return "Hardhat Localhost";
  return `chain ${chainId}`;
};

export function Web3Provider({ children }) {
  const [provider,   setProvider]   = useState(null);
  const [signer,     setSigner]     = useState(null);
  const [contract,   setContract]   = useState(null);
  const [account,    setAccount]    = useState(null);
  const [chainId,    setChainId]    = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error,      setError]      = useState(null);

  const initContract = useCallback((signerOrProvider) => {
    if (!CarRentalABI?.address) return null;
    return new ethers.Contract(CarRentalABI.address, CarRentalABI.abi, signerOrProvider);
  }, []);

  const ensureExpectedNetwork = useCallback(async (ethProvider) => {
    if (!EXPECTED_CHAIN_ID) return;

    const network = await ethProvider.getNetwork();
    if (Number(network.chainId) === EXPECTED_CHAIN_ID) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toChainIdHex(EXPECTED_CHAIN_ID) }],
      });
    } catch (err) {
      if (err.code !== 4902) throw err;

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: toChainIdHex(EXPECTED_CHAIN_ID),
            chainName: getNetworkLabel(EXPECTED_CHAIN_ID),
            nativeCurrency: {
              name: "Ethereum",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: [
              process.env.REACT_APP_RPC_URL ||
                "http://127.0.0.1:8545",
            ],
          },
        ],
      });
    }
  }, []);

  const ensureContractDeployed = useCallback(async (ethProvider) => {
    if (!CarRentalABI?.address) {
      throw new Error("DriveX contract address is missing. Deploy the contract first.");
    }

    const code = await ethProvider.getCode(CarRentalABI.address);
    if (code === "0x") {
      const network = await ethProvider.getNetwork();
      throw new Error(
        `DriveX contract not found at ${CarRentalABI.address} on ${getNetworkLabel(Number(network.chainId))}. ` +
        "Switch MetaMask to the deployed network or redeploy the contract."
      );
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      let _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);

      await ensureExpectedNetwork(_provider);

      _provider = new ethers.BrowserProvider(window.ethereum);
      await ensureContractDeployed(_provider);

      const _signer  = await _provider.getSigner();
      const _account = await _signer.getAddress();
      const network  = await _provider.getNetwork();
      const _contract = initContract(_signer);

      setProvider(_provider);
      setSigner(_signer);
      setAccount(_account);
      setChainId(Number(network.chainId));
      setContract(_contract);
      
      return {
        provider: _provider,
        signer: _signer,
        account: _account,
        contract: _contract,
      };
    } catch (err) {
      setProvider(null);
      setSigner(null);
      setContract(null);
      setAccount(null);
      setChainId(null);
      setError(err.message || "Failed to connect wallet");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [ensureContractDeployed, ensureExpectedNetwork, initContract]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setContract(null);
    setAccount(null);
    setChainId(null);
    setError(null);
    // Clear auth token to prevent stale session on reconnect
    localStorage.removeItem("drivex_token");
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect();
      else connect();
    };
    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [connect, disconnect]);

  // Auto-connect if already authorised
  useEffect(() => {
    if (!window.ethereum) {
      setInitialized(true);
      return;
    }

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) return connect();
        return null;
      })
      .catch(() => {})
      .finally(() => setInitialized(true));
  }, [connect]);

  return (
    <Web3Context.Provider
      value={{ provider, signer, contract, account, chainId, connecting, initialized, error, connect, disconnect }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside Web3Provider");
  return ctx;
}


/*
|--------------------------------------------------------------------------
| GLOBAL WEB3 / BLOCKCHAIN CONTEXT
|--------------------------------------------------------------------------
|
| This file manages all frontend blockchain connectivity.
|
| Responsibilities:
| - Connect MetaMask wallet
| - Store blockchain provider and signer
| - Initialize smart contract instance
| - Track connected wallet address
| - Track blockchain network (chainId)
| - Listen for wallet/account/network changes
| - Expose blockchain state globally
|
| Core Web3 Flow:
| MetaMask -> ethers.js -> Web3Context -> Entire Frontend
|
| Important Concepts:
| - provider = blockchain connection interface
| - signer = wallet authority capable of signing transactions/messages
| - contract = JavaScript representation of Solidity contract
| - ABI = interface describing smart contract functions/events
|
| Connection Flow:
| 1. User connects MetaMask
| 2. Provider is created
| 3. Signer is retrieved
| 4. Wallet address is fetched
| 5. Smart contract instance is initialized
| 6. Blockchain state becomes globally available
|
| Event Handling:
| - accountsChanged -> reconnect/disconnect wallet
| - chainChanged -> reload app on network switch
|
| Auto-Reconnect:
| - Automatically reconnects previously authorised wallets on refresh
|
| Global Values Exposed:
| - provider
| - signer
| - contract
| - account
| - chainId
| - connect()
| - disconnect()
| - error
|
| Architecture Notes:
| - This file handles blockchain connectivity ONLY
| - Authentication is handled separately in AuthContext
| - Future role-based logic should NOT be added here
|
*/
