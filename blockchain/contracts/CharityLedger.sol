
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CharityLedger {
    struct Campaign {
        uint256 id;
        address payable owner;
        string title;
        string description;
        uint256 goal;
        uint256 raised;
        uint256 withdrawn;
        bool active;
        uint256 deadline;
    }

    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256))
        public donations;
    mapping(uint256 => uint256) public campaignDonationCount;
    mapping(uint256 => uint256) public campaignDonorCount;
    mapping(uint256 => mapping(address => bool)) private hasDonated;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed owner,
        string title,
        uint256 goal
    );

    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    event FundsWithdrawn(
        uint256 indexed campaignId,
        address indexed owner,
        uint256 amount
    );

    modifier validCampaign(uint256 id) {
        require(id > 0 && id <= campaignCount,
            "Campaign does not exist");
        _;
    }

    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 goal
    ) external {
        _createCampaign(title, description, goal, 0);
    }

    function createCampaignWithDeadline(
        string calldata title,
        string calldata description,
        uint256 goal,
        uint256 deadline
    ) external {
        require(deadline > block.timestamp, "Deadline must be in the future");
        _createCampaign(title, description, goal, deadline);
    }

    function _createCampaign(
        string calldata title,
        string calldata description,
        uint256 goal,
        uint256 deadline
    ) internal {
        require(bytes(title).length > 0,
            "Title required");
        require(goal > 0, "Goal must be positive");

        campaignCount++;

        campaigns[campaignCount] = Campaign({
            id: campaignCount,
            owner: payable(msg.sender),
            title: title,
            description: description,
            goal: goal,
            raised: 0,
            withdrawn: 0,
            active: true,
            deadline: deadline
        });

        emit CampaignCreated(
            campaignCount,
            msg.sender,
            title,
            goal
        );
    }

    function donate(uint256 id)
        external
        payable
        validCampaign(id)
    {
        Campaign storage c = campaigns[id];

        require(c.active, "Campaign is closed");
        require(
            c.deadline == 0 || block.timestamp < c.deadline,
            "Campaign deadline has passed"
        );
        require(msg.value > 0, "Donation must be positive");

        c.raised += msg.value;
        donations[id][msg.sender] += msg.value;
        campaignDonationCount[id]++;
        if (!hasDonated[id][msg.sender]) {
            hasDonated[id][msg.sender] = true;
            campaignDonorCount[id]++;
        }

        emit DonationReceived(id, msg.sender, msg.value);
    }

    function withdraw(uint256 id, uint256 amount)
        external
        validCampaign(id)
    {
        Campaign storage c = campaigns[id];

        require(msg.sender == c.owner,
            "Only campaign owner");
        require(amount > 0, "Amount must be positive");
        require(amount <= c.raised - c.withdrawn,
            "Insufficient available funds");

        // Update state before transferring funds.
        c.withdrawn += amount;

        (bool success, ) = c.owner.call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(id, c.owner, amount);
    }

    function getCampaign(uint256 id)
        external
        view
        validCampaign(id)
        returns (Campaign memory)
    {
        return campaigns[id];
    }

    function getCampaignStatus(uint256 id)
        external
        view
        validCampaign(id)
        returns (
            bool isOpen,
            bool deadlinePassed,
            bool goalReached
        )
    {
        Campaign storage c = campaigns[id];
        deadlinePassed = c.deadline != 0 && block.timestamp >= c.deadline;
        goalReached = c.raised >= c.goal;
        isOpen = c.active && !deadlinePassed;
    }

    function getAvailableFunds(uint256 id)
        external
        view
        validCampaign(id)
        returns (uint256)
    {
        Campaign storage c = campaigns[id];
        return c.raised - c.withdrawn;
    }

    function getDonationAmount(uint256 id, address donor)
        external
        view
        validCampaign(id)
        returns (uint256)
    {
        return donations[id][donor];
    }

    function getCampaignStatistics(uint256 id)
        external
        view
        validCampaign(id)
        returns (
            uint256 totalRaised,
            uint256 goal,
            uint256 available,
            uint256 donationCount,
            uint256 uniqueDonorCount,
            uint256 averageDonation
        )
    {
        Campaign storage c = campaigns[id];
        donationCount = campaignDonationCount[id];
        totalRaised = c.raised;
        goal = c.goal;
        available = c.raised - c.withdrawn;
        uniqueDonorCount = campaignDonorCount[id];
        averageDonation = donationCount == 0
            ? 0
            : totalRaised / donationCount;
    }
}
