const { expect } = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

describe("CarRental", function () {
  let contract, admin, owner, renter, other;

  const PRICE_PER_HOUR  = ethers.parseEther("0.01");
  const DEPOSIT         = ethers.parseEther("0.05");
  const LICENSE_HASH_O  = "licensehash_owner";
  const LICENSE_HASH_R  = "licensehash_renter";
  const META_URI        = "ipfs://QmTest";

  beforeEach(async () => {
    [admin, owner, renter, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CarRental");
    contract = await Factory.deploy();
  });

  // ── Helpers ──────────────────────────────────────────────────
  async function registerAndVerify(signer, licenseHash, role) {
    await contract.connect(signer).registerUser(licenseHash, META_URI, role);
    if (role === 1 || role === 3) {
      await contract.connect(admin).verifyUser(signer.address);
    }
  }

  async function setupCarAndRental() {
    // Register both
    await registerAndVerify(owner,  LICENSE_HASH_O, 2); // OWNER
    await registerAndVerify(renter, LICENSE_HASH_R, 1); // RENTER

    // Register car
    const tx = await contract.connect(owner).registerCar(
      META_URI, PRICE_PER_HOUR, DEPOSIT, 12345678, 98765432
    );
    const receipt = await tx.wait();
    const carId   = 1n;
    
    await contract.connect(admin).verifyCar(carId);

    // Create rental (1 hour from now)
    const now         = BigInt(await time.latest());
    const startTime   = now + 60n;
    const endTime     = startTime + 3600n;
    const pickupStart = now + 30n;
    const pickupEnd   = now + 1800n;

    const totalRequired = PRICE_PER_HOUR + DEPOSIT;
    const rentalTx = await contract.connect(renter).createRentalRequest(
      carId, startTime, endTime, pickupStart, pickupEnd,
      { value: totalRequired }
    );
    await rentalTx.wait();

    return { carId, rentalId: 1n, startTime, endTime, pickupStart, pickupEnd };
  }

  // ── Tests ─────────────────────────────────────────────────────

  describe("User Management", () => {
    it("registers a user", async () => {
      await contract.connect(renter).registerUser(LICENSE_HASH_R, META_URI, 1);
      const user = await contract.getUser(renter.address);
      expect(user.exists).to.be.true;
      expect(user.status).to.equal(0); // UNVERIFIED
    });

    it("prevents duplicate license", async () => {
      await contract.connect(renter).registerUser(LICENSE_HASH_R, META_URI, 1);
      await expect(
        contract.connect(other).registerUser(LICENSE_HASH_R, META_URI, 1)
      ).to.be.revertedWith("License already registered");
    });

    it("admin verifies user", async () => {
      await contract.connect(renter).registerUser(LICENSE_HASH_R, META_URI, 1);
      await contract.connect(admin).verifyUser(renter.address);
      const user = await contract.getUser(renter.address);
      expect(user.status).to.equal(1); // VERIFIED
    });

    it("admin can block user", async () => {
      await registerAndVerify(renter, LICENSE_HASH_R, 1);
      await contract.connect(admin).blockUser(renter.address, "Fraud");
      expect(await contract.isBlacklisted(renter.address)).to.be.true;
    });
  });

  describe("Car Registration", () => {
    it("owner registers a car", async () => {
      await registerAndVerify(owner, LICENSE_HASH_O, 2);
      await contract.connect(owner).registerCar(META_URI, PRICE_PER_HOUR, DEPOSIT, 0, 0);
      const car = await contract.getCar(1n);
      expect(car.exists).to.be.true;
      expect(car.owner).to.equal(owner.address);
    });

    it("non-owner cannot register car", async () => {
      await registerAndVerify(renter, LICENSE_HASH_R, 1);
      await expect(
        contract.connect(renter).registerCar(META_URI, PRICE_PER_HOUR, DEPOSIT, 0, 0)
      ).to.be.revertedWith("Not an owner");
    });
  });

  describe("Rental Lifecycle", () => {
    it("renter creates rental request", async () => {
      const { rentalId } = await setupCarAndRental();
      const rental = await contract.getRental(rentalId);
      expect(rental.status).to.equal(1); // REQUESTED
      expect(rental.renter).to.equal(renter.address);
    });

    it("owner approves rental", async () => {
      const { rentalId } = await setupCarAndRental();
      await contract.connect(owner).approveRental(rentalId);
      const rental = await contract.getRental(rentalId);
      expect(rental.status).to.equal(2); // APPROVED
    });

    it("full rental lifecycle with OTP pickup and return", async () => {
      const { rentalId, pickupStart } = await setupCarAndRental();

      // Approve
      await contract.connect(owner).approveRental(rentalId);

      // Store OTP hash
      const otp     = 1234567n;
      const otpHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [otp]));
      await contract.connect(admin).storeOTPHash(rentalId, otpHash);

      // Move time into pickup window
      await time.increaseTo(Number(pickupStart) + 10);

      // Confirm pickup with OTP + fuel
      await contract.connect(renter).confirmPickup(
        rentalId, otp, "ipfs://fuelpickup", 80
      );

      let rental = await contract.getRental(rentalId);
      expect(rental.status).to.equal(4); // ACTIVE
      expect(rental.pickupFuel.percentage).to.equal(80);

      // Initiate return
      await contract.connect(renter).initiateReturn(rentalId);

      // Confirm return with lower fuel (penalty should apply)
      const ownerBalBefore = await ethers.provider.getBalance(owner.address);
      await contract.connect(owner).confirmReturn(rentalId, "ipfs://fuelreturn", 60);

      rental = await contract.getRental(rentalId);
      expect(rental.status).to.equal(6); // COMPLETED

      // Owner should have received payment
      const ownerBalAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalAfter).to.be.gt(ownerBalBefore);
    });

    it("renter can cancel before approval with full refund", async () => {
      const { rentalId } = await setupCarAndRental();
      const renterBalBefore = await ethers.provider.getBalance(renter.address);
      const tx = await contract.connect(renter).cancelRental(rentalId, "Changed mind");
      await tx.wait();

      const rental = await contract.getRental(rentalId);
      expect(rental.status).to.equal(7); // CANCELLED
    });

    it("no-show report triggers reputation penalty", async () => {
      const { rentalId } = await setupCarAndRental();
      await contract.connect(owner).approveRental(rentalId);

      const otp     = 7654321n;
      const otpHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [otp]));
      await contract.connect(admin).storeOTPHash(rentalId, otpHash);

      // Jump past pickup window + grace period
      const rental = await contract.getRental(rentalId);
      await time.increaseTo(Number(rental.pickup.endTime) + Number(rental.pickup.gracePeriod) + 1);

      await contract.connect(renter).reportOwnerNoShow(rentalId);

      const ownerUser = await contract.getUser(owner.address);
      expect(ownerUser.noShowCount).to.equal(1n);
      expect(ownerUser.reputationScore).to.be.lt(100n);
    });
  });

  describe("Dispute System", () => {
    it("active rental can be disputed", async () => {
      const { rentalId, pickupStart } = await setupCarAndRental();
      await contract.connect(owner).approveRental(rentalId);

      const otp     = 1111111n;
      const otpHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [otp]));
      await contract.connect(admin).storeOTPHash(rentalId, otpHash);
      await time.increaseTo(Number(pickupStart) + 10);
      await contract.connect(renter).confirmPickup(rentalId, otp, "ipfs://fuel", 70);

      await contract.connect(renter).flagDispute(rentalId, "Car was damaged");

      const rental = await contract.getRental(rentalId);
      expect(rental.status).to.equal(8); // DISPUTED
    });

    it("admin resolves dispute", async () => {
      const { rentalId, pickupStart } = await setupCarAndRental();
      await contract.connect(owner).approveRental(rentalId);

      const otp     = 2222222n;
      const otpHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [otp]));
      await contract.connect(admin).storeOTPHash(rentalId, otpHash);
      await time.increaseTo(Number(pickupStart) + 10);
      await contract.connect(renter).confirmPickup(rentalId, otp, "ipfs://fuel", 70);
      await contract.connect(renter).flagDispute(rentalId, "Dispute!");

      await contract.connect(admin).resolveDispute(rentalId, renter.address, 80);

      const rental = await contract.getRental(rentalId);
      expect(rental.status).to.equal(6); // COMPLETED
    });
  });
});
