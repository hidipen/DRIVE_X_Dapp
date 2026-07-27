const { ethers } = require("ethers");
const fs         = require("fs");
const path       = require("path");

let _provider, _adminWallet, _contract;

function getABI() {
  const abiPath = path.join(__dirname, "../abi/CarRental.json");
  if (!fs.existsSync(abiPath)) {
    throw new Error("ABI file not found. Run `npx hardhat run scripts/deploy.js` first.");
  }
  return JSON.parse(fs.readFileSync(abiPath, "utf8"));
}

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  }
  return _provider;
}

function getAdminWallet() {
  if (!_adminWallet) {
    _adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, getProvider());
  }
  return _adminWallet;
}

function getContract(signerOrProvider = null) {
  const { abi, address } = getABI();
  const runner = signerOrProvider || getProvider();
  return new ethers.Contract(address, abi, runner);
}

function getAdminContract() {
  return getContract(getAdminWallet());
}

/**
 * Hash a 7-digit OTP the same way the contract does:
 * keccak256(abi.encodePacked(uint256(otp)))
 */
function hashOTP(otp) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(otp)])
  );
}

/**
 * Store OTP hash on-chain (admin relay).
 */
async function storeOTPHashOnChain(rentalId, otpHash) {
  const contract = getAdminContract();
  const tx = await contract.storeOTPHash(rentalId, otpHash);
  return tx.wait();
}

/**
 * Read a rental from chain.
 */
async function getRentalOnChain(rentalId) {
  const contract = getContract();
  return contract.getRental(rentalId);
}

/**
 * Read all cars from chain (returns array of Car structs).
 */
async function getAllCarsOnChain() {
  const contract = getContract();
  const ids = await contract.getAllCarIds();
  const cars = await Promise.all(ids.map((id) => contract.getCar(id)));
  return cars;
}

/**
 * Fetch users pending verification by checking UserRegistered events.
 */
async function getPendingUsersOnChain() {
  const contract = getContract();
  const filter = contract.filters.UserRegistered();
  const events = await contract.queryFilter(filter, 0, "latest");
  const uniqueWallets = [...new Set(events.map(e => e.args.wallet))];
  
  const users = await Promise.all(uniqueWallets.map(w => contract.getUser(w)));
  // Filter for UNVERIFIED (status == 0) and roles that need docs (RENTER or BOTH)
  return users.filter(u => Number(u.status) === 0 && (Number(u.role) === 1 || Number(u.role) === 3));
}

/**
 * Fetch cars pending verification.
 */
async function getPendingCarsOnChain() {
  const allCars = await getAllCarsOnChain();
  // status == 1 is PENDING_VERIFICATION
  return allCars.filter(c => Number(c.status) === 1);
}

/**
 * Block a user on-chain (admin).
 */
async function blockUserOnChain(walletAddress, reason) {
  const contract = getAdminContract();
  const tx = await contract.blockUser(walletAddress, reason);
  return tx.wait();
}

/**
 * Verify a user on-chain (admin).
 */
async function verifyUserOnChain(walletAddress) {
  const contract = getAdminContract();
  const tx = await contract.verifyUser(walletAddress);
  return tx.wait();
}

/**
 * Resolve a dispute on-chain (admin).
 */
async function resolveDisputeOnChain(rentalId, favouredParty, renterShare) {
  const contract = getAdminContract();
  const tx = await contract.resolveDispute(rentalId, favouredParty, renterShare);
  return tx.wait();
}

/**
 * Parse chain events from a receipt.
 */
function parseEvents(receipt, eventName) {
  const { abi }    = getABI();
  const iface      = new ethers.Interface(abi);
  const events     = [];
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === eventName) {
        events.push(parsed.args);
      }
    } catch { /* skip unrelated logs */ }
  }
  return events;
}

/**
 * Reject a user on-chain (admin).
 */
async function rejectUserOnChain(walletAddress, reason) {
  const contract = getAdminContract();
  const tx = await contract.rejectUser(walletAddress, reason);
  return tx.wait();
}

/**
 * Verify a car on-chain (admin).
 */
async function verifyCarOnChain(carId) {
  const contract = getAdminContract();
  const tx = await contract.verifyCar(carId);
  return tx.wait();
}

/**
 * Reject a car on-chain (admin).
 */
async function rejectCarOnChain(carId, reason) {
  const contract = getAdminContract();
  const tx = await contract.rejectCar(carId, reason);
  return tx.wait();
}

module.exports = {
  getProvider,
  getAdminWallet,
  getContract,
  getAdminContract,
  hashOTP,
  storeOTPHashOnChain,
  getRentalOnChain,
  getAllCarsOnChain,
  getPendingUsersOnChain,
  getPendingCarsOnChain,
  blockUserOnChain,
  verifyUserOnChain,
  resolveDisputeOnChain,
  parseEvents,
  rejectUserOnChain,
  verifyCarOnChain,
  rejectCarOnChain,
};
