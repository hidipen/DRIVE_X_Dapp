// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CarRental
 * @dev MVP blockchain-based P2P car rental platform
 *      Handles: user verification, car registration, rental lifecycle,
 *               OTP pickup, fuel proof, deposit management, reputation
 */
contract CarRental {

    // ─────────────────────────────────────────────
    //  ENUMS
    // ─────────────────────────────────────────────

    enum UserRole        { NONE, RENTER, OWNER, BOTH }
    enum UserStatus      { UNVERIFIED, VERIFIED, BLOCKED, REJECTED }
    enum CarStatus       { UNAVAILABLE, PENDING_VERIFICATION, AVAILABLE, RENTED, REJECTED }
    enum RentalStatus    {
        NONE,
        REQUESTED,
        APPROVED,
        PICKUP_PENDING,
        ACTIVE,
        RETURN_PENDING,
        COMPLETED,
        CANCELLED,
        DISPUTED
    }

    // ─────────────────────────────────────────────
    //  STRUCTS
    // ─────────────────────────────────────────────

    struct User {
        address wallet;
        string  licenseHash;       // keccak256 of license number (off-chain)
        string  metadataURI;       // IPFS URI for docs
        UserRole  role;
        UserStatus status;
        uint256 reputationScore;   // starts at 100
        uint256 noShowCount;
        bool    exists;
    }

    struct Car {
        uint256 id;
        address owner;
        string  metadataURI;       // IPFS URI with make/model/images
        uint256 pricePerHour;      // in wei
        uint256 securityDeposit;   // in wei
        int256  lat;               // latitude  × 1e6
        int256  lng;               // longitude × 1e6
        CarStatus status;
        bool    exists;
    }

    struct PickupWindow {
        uint256 startTime;
        uint256 endTime;
        uint256 gracePeriod;   // seconds (default 1800 = 30 min)
    }

    struct FuelRecord {
        string  ipfsHash;
        uint8   percentage;    // 0–100
        uint256 timestamp;
    }

    struct Rental {
        uint256    id;
        uint256    carId;
        address    renter;
        address    owner;
        uint256    startTime;
        uint256    endTime;
        uint256    depositPaid;
        uint256    totalCost;
        PickupWindow pickup;
        FuelRecord pickupFuel;
        FuelRecord returnFuel;
        RentalStatus status;
        bytes32    otpHash;         // keccak256(otp) stored by backend relay
        bool       otpConfirmed;
        string     disputeReason;
        bool       exists;
    }

    // ─────────────────────────────────────────────
    //  STATE
    // ─────────────────────────────────────────────

    address public admin;

    mapping(address => User)   public users;
    mapping(string  => bool)   public licenseUsed;     // prevent duplicate license

    uint256 public carCounter;
    mapping(uint256 => Car)    public cars;

    uint256 public rentalCounter;
    mapping(uint256 => Rental) public rentals;

    // renter/owner → active rental id (0 = none)
    mapping(address => uint256) public activeRental;

    // blacklist
    mapping(address => bool)   public blacklisted;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event UserRegistered(address indexed wallet, UserRole role);
    event UserRoleUpdated(address indexed wallet, UserRole newRole);
    event UserVerified(address indexed wallet);
    event UserBlocked(address indexed wallet, string reason);
    event UserRejected(address indexed wallet, string reason);

    event CarRegistered(uint256 indexed carId, address indexed owner);
    event CarAvailabilityUpdated(uint256 indexed carId, CarStatus status);
    event CarRejected(uint256 indexed carId, string reason);

    event RentalRequested(uint256 indexed rentalId, address indexed renter, uint256 indexed carId);
    event RentalApproved(uint256 indexed rentalId);
    event RentalCancelled(uint256 indexed rentalId, string reason);

    event PickupWindowSet(uint256 indexed rentalId, uint256 start, uint256 end);
    event OTPHashStored(uint256 indexed rentalId);
    event PickupConfirmed(uint256 indexed rentalId, uint256 timestamp);
    event FuelRecordedAtPickup(uint256 indexed rentalId, uint8 percentage, string ipfsHash);

    event ReturnInitiated(uint256 indexed rentalId);
    event FuelRecordedAtReturn(uint256 indexed rentalId, uint8 percentage, string ipfsHash);
    event RentalCompleted(uint256 indexed rentalId, uint256 refundAmount, uint256 penalty);

    event DisputeFlagged(uint256 indexed rentalId, string reason);
    event DisputeResolved(uint256 indexed rentalId, address favouredParty);

    event OwnerNoShowReported(uint256 indexed rentalId, address indexed owner);
    event ReputationUpdated(address indexed user, uint256 newScore);

    event DepositPaid(uint256 indexed rentalId, address indexed renter, uint256 amount);
    event DepositRefunded(uint256 indexed rentalId, address indexed renter, uint256 amount);
    event PenaltyDeducted(uint256 indexed rentalId, uint256 amount);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyVerified() {
        require(users[msg.sender].status == UserStatus.VERIFIED, "Not verified");
        _;
    }

    modifier notBlacklisted() {
        require(!blacklisted[msg.sender], "Blacklisted");
        _;
    }

    modifier rentalExists(uint256 _id) {
        require(rentals[_id].exists, "Rental not found");
        _;
    }

    modifier carExists(uint256 _id) {
        require(cars[_id].exists, "Car not found");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() {
        admin = msg.sender;
    }

    // ─────────────────────────────────────────────
    //  PHASE 1: USER MANAGEMENT
    // ─────────────────────────────────────────────

    /**
     * @dev Register a new user. licenseHash must be unique.
     */
    function registerUser(
        string calldata _licenseHash,
        string calldata _metadataURI,
        UserRole _role
    ) external notBlacklisted {
        require(!users[msg.sender].exists, "Already registered");
        require(_role != UserRole.NONE,    "Invalid role");

        if (bytes(_licenseHash).length > 0) {
            require(!licenseUsed[_licenseHash], "License already registered");
            licenseUsed[_licenseHash] = true;
        }

        UserStatus initialStatus = (_role == UserRole.OWNER) ? UserStatus.VERIFIED : UserStatus.UNVERIFIED;

        users[msg.sender] = User({
            wallet:         msg.sender,
            licenseHash:    _licenseHash,
            metadataURI:    _metadataURI,
            role:           _role,
            status:         initialStatus,
            reputationScore: 100,
            noShowCount:    0,
            exists:         true
        });

        emit UserRegistered(msg.sender, _role);
    }

    /**
     * @dev Allows an existing user to update their role (e.g. OWNER -> BOTH).
     */
    function updateUserRole(
        string calldata _licenseHash,
        string calldata _metadataURI,
        UserRole _newRole
    ) external notBlacklisted {
        require(users[msg.sender].exists, "User not found");
        require(_newRole != UserRole.NONE, "Invalid role");
        require(users[msg.sender].role != _newRole, "Role already set to this");
        
        if (bytes(_licenseHash).length > 0) {
            if (keccak256(bytes(users[msg.sender].licenseHash)) != keccak256(bytes(_licenseHash))) {
                require(!licenseUsed[_licenseHash], "License already registered");
                licenseUsed[_licenseHash] = true;
                users[msg.sender].licenseHash = _licenseHash;
            }
        }
        
        if (bytes(_metadataURI).length > 0) {
            users[msg.sender].metadataURI = _metadataURI;
        }

        users[msg.sender].role = _newRole;
        
        if (_newRole == UserRole.RENTER || _newRole == UserRole.BOTH) {
            users[msg.sender].status = UserStatus.UNVERIFIED;
        }

        emit UserRoleUpdated(msg.sender, _newRole);
    }

    /**
     * @dev Admin verifies a user after off-chain document check.
     */
    function verifyUser(address _user) external onlyAdmin {
        require(users[_user].exists,  "User not found");
        require(users[_user].status == UserStatus.UNVERIFIED, "Already processed");
        users[_user].status = UserStatus.VERIFIED;
        emit UserVerified(_user);
    }

    /**
     * @dev Admin rejects a user application.
     */
    function rejectUser(address _user, string calldata _reason) external onlyAdmin {
        require(users[_user].exists, "User not found");
        users[_user].status = UserStatus.REJECTED;
        emit UserRejected(_user, _reason);
    }

    /**
     * @dev Admin blocks a user and adds to blacklist.
     */
    function blockUser(address _user, string calldata _reason) external onlyAdmin {
        require(users[_user].exists, "User not found");
        users[_user].status = UserStatus.BLOCKED;
        blacklisted[_user] = true;
        emit UserBlocked(_user, _reason);
    }

    // ─────────────────────────────────────────────
    //  PHASE 2: CAR REGISTRY
    // ─────────────────────────────────────────────

    /**
     * @dev Register a car. Caller must have OWNER or BOTH role.
     */
    function registerCar(
        string  calldata _metadataURI,
        uint256 _pricePerHour,
        uint256 _securityDeposit,
        int256  _lat,
        int256  _lng
    ) external notBlacklisted returns (uint256) {
        require(
            users[msg.sender].role == UserRole.OWNER ||
            users[msg.sender].role == UserRole.BOTH,
            "Not an owner"
        );
        require(_pricePerHour > 0,    "Price must be > 0");
        require(_securityDeposit > 0, "Deposit must be > 0");

        carCounter++;
        cars[carCounter] = Car({
            id:              carCounter,
            owner:           msg.sender,
            metadataURI:     _metadataURI,
            pricePerHour:    _pricePerHour,
            securityDeposit: _securityDeposit,
            lat:             _lat,
            lng:             _lng,
            status:          CarStatus.PENDING_VERIFICATION,
            exists:          true
        });

        emit CarRegistered(carCounter, msg.sender);
        return carCounter;
    }

    /**
     * @dev Admin verifies a car.
     */
    function verifyCar(uint256 _carId) external onlyAdmin carExists(_carId) {
        require(cars[_carId].status == CarStatus.PENDING_VERIFICATION, "Not pending verification");
        cars[_carId].status = CarStatus.AVAILABLE;
        emit CarAvailabilityUpdated(_carId, CarStatus.AVAILABLE);
    }

    /**
     * @dev Admin rejects a car.
     */
    function rejectCar(uint256 _carId, string calldata _reason) external onlyAdmin carExists(_carId) {
        require(cars[_carId].status == CarStatus.PENDING_VERIFICATION, "Not pending verification");
        cars[_carId].status = CarStatus.REJECTED;
        emit CarRejected(_carId, _reason);
    }

    /**
     * @dev Owner can toggle car availability.
     */
    function updateCarAvailability(uint256 _carId, CarStatus _status)
        external carExists(_carId)
    {
        require(cars[_carId].owner == msg.sender, "Not car owner");
        require(_status != CarStatus.RENTED,      "Cannot manually set RENTED");
        require(_status != CarStatus.PENDING_VERIFICATION, "Cannot manually set PENDING");
        require(cars[_carId].status != CarStatus.PENDING_VERIFICATION, "Car still pending admin verification");
        require(cars[_carId].status != CarStatus.REJECTED, "Car was rejected by admin");
        
        cars[_carId].status = _status;
        emit CarAvailabilityUpdated(_carId, _status);
    }

    // ─────────────────────────────────────────────
    //  PHASE 3: RENTAL REQUEST & APPROVAL
    // ─────────────────────────────────────────────

    /**
     * @dev Renter requests a rental. Must pay deposit upfront.
     * @param _carId        target car
     * @param _startTime    desired rental start (unix)
     * @param _endTime      desired rental end   (unix)
     * @param _pickupStart  pickup window start  (unix)
     * @param _pickupEnd    pickup window end    (unix)
     */
    function createRentalRequest(
        uint256 _carId,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _pickupStart,
        uint256 _pickupEnd
    ) external payable onlyVerified notBlacklisted carExists(_carId) returns (uint256) {
        require(
            users[msg.sender].role == UserRole.RENTER ||
            users[msg.sender].role == UserRole.BOTH,
            "Not a renter"
        );
        require(cars[_carId].status == CarStatus.AVAILABLE, "Car not available");
        require(cars[_carId].owner != msg.sender,           "Cannot rent own car");
        require(_endTime > _startTime,                      "Invalid time range");
        require(_pickupEnd > _pickupStart,                  "Invalid pickup window");
        require(_pickupStart >= block.timestamp,            "Pickup in the past");
        require(activeRental[msg.sender] == 0,              "Already have active rental");

        Car storage car = cars[_carId];

        // Calculate expected cost + deposit
        uint256 durationHours = (_endTime - _startTime) / 3600;
        if (durationHours == 0) durationHours = 1;
        uint256 rentalCost = durationHours * car.pricePerHour;
        uint256 totalRequired = rentalCost + car.securityDeposit;

        require(msg.value >= totalRequired, "Insufficient payment");

        rentalCounter++;
        rentals[rentalCounter] = Rental({
            id:          rentalCounter,
            carId:       _carId,
            renter:      msg.sender,
            owner:       car.owner,
            startTime:   _startTime,
            endTime:     _endTime,
            depositPaid: msg.value,
            totalCost:   rentalCost,
            pickup: PickupWindow({
                startTime:   _pickupStart,
                endTime:     _pickupEnd,
                gracePeriod: 1800
            }),
            pickupFuel:  FuelRecord({ ipfsHash: "", percentage: 0, timestamp: 0 }),
            returnFuel:  FuelRecord({ ipfsHash: "", percentage: 0, timestamp: 0 }),
            status:      RentalStatus.REQUESTED,
            otpHash:     bytes32(0),
            otpConfirmed: false,
            disputeReason: "",
            exists:      true
        });

        // Lock car
        car.status = CarStatus.RENTED;
        activeRental[msg.sender] = rentalCounter;

        emit RentalRequested(rentalCounter, msg.sender, _carId);
        emit DepositPaid(rentalCounter, msg.sender, msg.value);
        return rentalCounter;
    }

    /**
     * @dev Owner approves the rental request.
     */
    function approveRental(uint256 _rentalId)
        external onlyVerified rentalExists(_rentalId)
    {
        Rental storage r = rentals[_rentalId];
        require(r.owner == msg.sender,             "Not the car owner");
        require(r.status == RentalStatus.REQUESTED, "Not in REQUESTED state");

        r.status = RentalStatus.APPROVED;
        emit RentalApproved(_rentalId);
    }

    /**
     * @dev Owner or renter can cancel before approval. Renter gets full refund.
     */
    function cancelRental(uint256 _rentalId, string calldata _reason)
        external rentalExists(_rentalId)
    {
        Rental storage r = rentals[_rentalId];
        require(
            r.renter == msg.sender || r.owner == msg.sender,
            "Not a party to this rental"
        );
        require(
            r.status == RentalStatus.REQUESTED ||
            r.status == RentalStatus.APPROVED,
            "Cannot cancel at this stage"
        );

        r.status = RentalStatus.CANCELLED;
        cars[r.carId].status = CarStatus.AVAILABLE;
        activeRental[r.renter] = 0;

        // Full refund to renter
        uint256 refund = r.depositPaid;
        r.depositPaid = 0;
        payable(r.renter).transfer(refund);

        // Reputation hit for owner cancellation
        if (msg.sender == r.owner) {
            _decreaseReputation(r.owner, 10);
        }

        emit RentalCancelled(_rentalId, _reason);
        emit DepositRefunded(_rentalId, r.renter, refund);
    }

    // ─────────────────────────────────────────────
    //  PHASE 4: PICKUP SYSTEM (OTP + FUEL)
    // ─────────────────────────────────────────────

    /**
     * @dev Backend relay stores the OTP hash on-chain before pickup.
     *      Only admin/backend can call this.
     */
    function storeOTPHash(uint256 _rentalId, bytes32 _otpHash)
        external onlyAdmin rentalExists(_rentalId)
    {
        Rental storage r = rentals[_rentalId];
        require(r.status == RentalStatus.APPROVED, "Rental not approved");

        r.otpHash  = _otpHash;
        r.status   = RentalStatus.PICKUP_PENDING;
        emit OTPHashStored(_rentalId);
        emit PickupWindowSet(_rentalId, r.pickup.startTime, r.pickup.endTime);
    }

    /**
     * @dev Renter submits OTP at pickup. Backend sends the plaintext OTP,
     *      contract verifies hash matches stored hash.
     * @param _otp plaintext 7-digit OTP (as uint)
     */
    function confirmPickup(
        uint256 _rentalId,
        uint256 _otp,
        string calldata _fuelIpfsHash,
        uint8   _fuelPercentage
    ) external rentalExists(_rentalId) {
        Rental storage r = rentals[_rentalId];
        require(r.renter == msg.sender,                    "Not the renter");
        require(r.status == RentalStatus.PICKUP_PENDING,   "Not in PICKUP_PENDING");
        require(!r.otpConfirmed,                           "Already confirmed");

        // Check pickup window (with grace period)
        uint256 windowEnd = r.pickup.endTime + r.pickup.gracePeriod;
        require(block.timestamp >= r.pickup.startTime, "Pickup window not started");
        require(block.timestamp <= windowEnd,          "Pickup window expired");

        // Verify OTP
        require(keccak256(abi.encodePacked(_otp)) == r.otpHash, "Invalid OTP");

        // Record pickup fuel
        require(_fuelPercentage <= 100, "Invalid fuel %");
        r.pickupFuel = FuelRecord({
            ipfsHash:   _fuelIpfsHash,
            percentage: _fuelPercentage,
            timestamp:  block.timestamp
        });

        r.otpConfirmed = true;
        r.status       = RentalStatus.ACTIVE;

        emit PickupConfirmed(_rentalId, block.timestamp);
        emit FuelRecordedAtPickup(_rentalId, _fuelPercentage, _fuelIpfsHash);
    }

    /**
     * @dev Renter reports owner no-show after pickup window expires.
     */
    function reportOwnerNoShow(uint256 _rentalId)
        external rentalExists(_rentalId)
    {
        Rental storage r = rentals[_rentalId];
        require(r.renter == msg.sender,                  "Not the renter");
        require(r.status == RentalStatus.PICKUP_PENDING, "Not in PICKUP_PENDING");

        uint256 windowEnd = r.pickup.endTime + r.pickup.gracePeriod;
        require(block.timestamp > windowEnd, "Pickup window still open");

        r.status = RentalStatus.CANCELLED;
        cars[r.carId].status = CarStatus.AVAILABLE;
        activeRental[r.renter] = 0;

        // Reputation penalty for owner
        User storage owner = users[r.owner];
        owner.noShowCount++;
        _decreaseReputation(r.owner, 15);

        // Auto-suspend owner if too many no-shows
        if (owner.noShowCount >= 3) {
            owner.status = UserStatus.BLOCKED;
            blacklisted[r.owner] = true;
            emit UserBlocked(r.owner, "Auto-suspended: 3 no-shows");
        }

        // Full refund to renter
        uint256 refund = r.depositPaid;
        r.depositPaid = 0;
        payable(r.renter).transfer(refund);

        emit OwnerNoShowReported(_rentalId, r.owner);
        emit DepositRefunded(_rentalId, r.renter, refund);
    }

    // ─────────────────────────────────────────────
    //  PHASE 5: RETURN & SETTLEMENT
    // ─────────────────────────────────────────────

    /**
     * @dev Renter initiates return.
     */
    function initiateReturn(uint256 _rentalId)
        external rentalExists(_rentalId)
    {
        Rental storage r = rentals[_rentalId];
        require(r.renter == msg.sender,            "Not the renter");
        require(r.status == RentalStatus.ACTIVE,   "Rental not active");

        r.status = RentalStatus.RETURN_PENDING;
        emit ReturnInitiated(_rentalId);
    }

    /**
     * @dev Owner confirms car return, records return fuel, triggers settlement.
     */
    function confirmReturn(
        uint256 _rentalId,
        string calldata _returnFuelIpfsHash,
        uint8   _returnFuelPercentage
    ) external rentalExists(_rentalId) {
        Rental storage r = rentals[_rentalId];
        require(r.owner == msg.sender,                      "Not the owner");
        require(r.status == RentalStatus.RETURN_PENDING,    "Not in RETURN_PENDING");
        require(_returnFuelPercentage <= 100,               "Invalid fuel %");

        r.returnFuel = FuelRecord({
            ipfsHash:   _returnFuelIpfsHash,
            percentage: _returnFuelPercentage,
            timestamp:  block.timestamp
        });

        emit FuelRecordedAtReturn(_rentalId, _returnFuelPercentage, _returnFuelIpfsHash);

        _finalizeRental(_rentalId);
    }

    /**
     * @dev Internal settlement logic.
     */
    function _finalizeRental(uint256 _rentalId) internal {
        Rental storage r = rentals[_rentalId];

        r.status = RentalStatus.COMPLETED;
        cars[r.carId].status = CarStatus.AVAILABLE;
        activeRental[r.renter] = 0;

        uint256 penalty = 0;

        // Fuel penalty: 1% of deposit per fuel unit missing (capped at 50%)
        if (r.returnFuel.percentage < r.pickupFuel.percentage) {
            uint8 fuelDiff = r.pickupFuel.percentage - r.returnFuel.percentage;
            // Each 1% fuel missing = 1% of security deposit (portion)
            uint256 baseDeposit = r.depositPaid - r.totalCost;
            penalty = (uint256(fuelDiff) * baseDeposit) / 100;
            // Cap penalty at 50% of deposit
            if (penalty > baseDeposit / 2) {
                penalty = baseDeposit / 2;
            }
        }

        uint256 refundToRenter = r.depositPaid - r.totalCost - penalty;

        // Pay owner: rental cost + any fuel penalty
        uint256 ownerPayment = r.totalCost + penalty;

        if (penalty > 0) {
            emit PenaltyDeducted(_rentalId, penalty);
        }

        // Improve both parties' reputation on successful completion
        _increaseReputation(r.renter, 5);
        _increaseReputation(r.owner, 5);

        // Transfers
        payable(r.owner).transfer(ownerPayment);
        if (refundToRenter > 0) {
            payable(r.renter).transfer(refundToRenter);
        }

        emit RentalCompleted(_rentalId, refundToRenter, penalty);
        emit DepositRefunded(_rentalId, r.renter, refundToRenter);
    }

    // ─────────────────────────────────────────────
    //  PHASE 7: DISPUTE SYSTEM
    // ─────────────────────────────────────────────

    /**
     * @dev Either party can flag a dispute on an active or return-pending rental.
     */
    function flagDispute(uint256 _rentalId, string calldata _reason)
        external rentalExists(_rentalId)
    {
        Rental storage r = rentals[_rentalId];
        require(
            r.renter == msg.sender || r.owner == msg.sender,
            "Not a party"
        );
        require(
            r.status == RentalStatus.ACTIVE ||
            r.status == RentalStatus.RETURN_PENDING,
            "Cannot dispute at this stage"
        );

        r.status        = RentalStatus.DISPUTED;
        r.disputeReason = _reason;
        emit DisputeFlagged(_rentalId, _reason);
    }

    /**
     * @dev Admin resolves dispute, specifying favoured party and split.
     * @param _renterShare percentage (0–100) of locked funds returned to renter
     */
    function resolveDispute(
        uint256 _rentalId,
        address _favouredParty,
        uint8   _renterShare
    ) external onlyAdmin rentalExists(_rentalId) {
        Rental storage r = rentals[_rentalId];
        require(r.status == RentalStatus.DISPUTED, "Not disputed");
        require(_renterShare <= 100,               "Invalid share");

        r.status = RentalStatus.COMPLETED;
        cars[r.carId].status = CarStatus.AVAILABLE;
        activeRental[r.renter] = 0;

        uint256 total    = r.depositPaid;
        uint256 toRenter = (total * _renterShare) / 100;
        uint256 toOwner  = total - toRenter;

        if (toRenter > 0) payable(r.renter).transfer(toRenter);
        if (toOwner  > 0) payable(r.owner).transfer(toOwner);

        // Penalise non-favoured party
        if (_favouredParty == r.renter) {
            _decreaseReputation(r.owner, 20);
        } else {
            _decreaseReputation(r.renter, 20);
        }

        emit DisputeResolved(_rentalId, _favouredParty);
    }

    // ─────────────────────────────────────────────
    //  REPUTATION HELPERS
    // ─────────────────────────────────────────────

    function _decreaseReputation(address _user, uint256 _amount) internal {
        if (!users[_user].exists) return;
        User storage u = users[_user];
        if (u.reputationScore > _amount) {
            u.reputationScore -= _amount;
        } else {
            u.reputationScore = 0;
        }
        emit ReputationUpdated(_user, u.reputationScore);
    }

    function _increaseReputation(address _user, uint256 _amount) internal {
        if (!users[_user].exists) return;
        User storage u = users[_user];
        u.reputationScore += _amount;
        if (u.reputationScore > 200) u.reputationScore = 200; // cap
        emit ReputationUpdated(_user, u.reputationScore);
    }

    // ─────────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ─────────────────────────────────────────────

    function getUser(address _wallet) external view returns (User memory) {
        return users[_wallet];
    }

    function getCar(uint256 _carId) external view returns (Car memory) {
        return cars[_carId];
    }

    function getRental(uint256 _rentalId) external view returns (Rental memory) {
        return rentals[_rentalId];
    }

    function getActiveRentalId(address _user) external view returns (uint256) {
        return activeRental[_user];
    }

    function isBlacklisted(address _user) external view returns (bool) {
        return blacklisted[_user];
    }

    /**
     * @dev Returns all car IDs (frontend filters by location/availability).
     */
    function getAllCarIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](carCounter);
        for (uint256 i = 1; i <= carCounter; i++) {
            ids[i - 1] = i;
        }
        return ids;
    }

    /**
     * @dev Returns all rental IDs for a given renter or owner.
     */
    function getRentalsByUser(address _user)
        external view returns (uint256[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 1; i <= rentalCounter; i++) {
            if (rentals[i].renter == _user || rentals[i].owner == _user) {
                count++;
            }
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= rentalCounter; i++) {
            if (rentals[i].renter == _user || rentals[i].owner == _user) {
                result[idx++] = i;
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────
    //  ADMIN HELPERS
    // ─────────────────────────────────────────────

    function transferAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    receive() external payable {}
}
