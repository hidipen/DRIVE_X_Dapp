import { useCallback } from "react";
import { useWeb3 } from "../context/Web3Context";
import { ethers } from "ethers";
import { toast } from "react-toastify";

/**
 * Wraps contract calls with loading/error handling.
 * Returns a `send` function that shows toast notifications.
 */
export function useContract() {
  const { contract } = useWeb3();

  const send = useCallback(
    async (method, args = [], overrides = {}, description = "") => {
      if (!contract) throw new Error("Contract not loaded");
      const toastId = toast.loading(description || `Sending transaction…`);
      try {
        const tx = await contract[method](...args, overrides);
        toast.update(toastId, { render: "Waiting for confirmation…", isLoading: true });
        const receipt = await tx.wait();
        toast.update(toastId, {
          render:    description ? `${description} — confirmed!` : "Transaction confirmed!",
          type:      "success",
          isLoading: false,
          autoClose: 4000,
        });
        return receipt;
      } catch (err) {
        const msg = err.reason || err.message || "Transaction failed";
        toast.update(toastId, {
          render:    msg,
          type:      "error",
          isLoading: false,
          autoClose: 6000,
        });
        throw err;
      }
    },
    [contract]
  );

  const read = useCallback(
    async (method, args = []) => {
      if (!contract) throw new Error("Contract not loaded");
      return contract[method](...args);
    },
    [contract]
  );

  return { send, read, contract };
}


/*
|--------------------------------------------------------------------------
| SMART CONTRACT INTERACTION HOOK
|--------------------------------------------------------------------------
|
| This hook provides reusable helper functions for interacting with the
| CarRental smart contract.
|
| Responsibilities:
| - Handle blockchain write transactions
| - Handle blockchain read calls
| - Manage transaction confirmation flow
| - Display loading/success/error toast notifications
| - Standardize smart contract interaction across frontend
|
| Architecture:
| Web3Context -> useContract -> Pages/Components
|
| Core Functions:
|
| send():
| - Used for blockchain WRITE operations
| - Sends transactions requiring wallet signature
| - Waits for blockchain confirmation using tx.wait()
| - Handles loading/error/success notifications
|
| read():
| - Used for blockchain READ operations
| - Calls view/pure contract methods
| - No gas fees or confirmations required
|
| Important Blockchain Concepts:
| - Transaction submission != confirmation
| - tx.wait() waits for mined confirmation
| - READ operations are free
| - WRITE operations require gas + signature
|
| UX Features:
| - Toast notifications for transaction lifecycle
| - Friendly blockchain error handling
|
| Notes:
| - This file abstracts blockchain complexity away from UI pages
| - Dynamic method calls use contract[method](...)
| - Future business logic should remain outside this hook
|
*/