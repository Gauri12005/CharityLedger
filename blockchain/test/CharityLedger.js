const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CharityLedger campaign deadlines", function () {
  async function deployLedger() {
    const [owner, donor] = await ethers.getSigners();
    const CharityLedger = await ethers.getContractFactory("CharityLedger");
    const ledger = await CharityLedger.deploy();
    await ledger.waitForDeployment();
    return { ledger, owner, donor };
  }

  async function expectRevert(promise, reason) {
    let error;
    try {
      await promise;
    } catch (caught) {
      error = caught;
    }

    expect(error, "expected transaction to revert").to.not.equal(undefined);
    expect(error.message).to.include(reason);
  }

  it("creates a campaign with a future deadline and reports its status", async function () {
    const { ledger } = await deployLedger();
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    await ledger.createCampaignWithDeadline(
      "Community garden",
      "Planting supplies",
      ethers.parseEther("2"),
      deadline
    );

    const campaign = await ledger.getCampaign(1);
    const status = await ledger.getCampaignStatus(1);

    expect(campaign.deadline).to.equal(BigInt(deadline));
    expect(status.isOpen).to.equal(true);
    expect(status.deadlinePassed).to.equal(false);
    expect(status.goalReached).to.equal(false);
  });

  it("rejects a campaign deadline that is not in the future", async function () {
    const { ledger } = await deployLedger();
    const latestBlock = await ethers.provider.getBlock("latest");

    await expectRevert(
      ledger.createCampaignWithDeadline(
        "Community garden",
        "Planting supplies",
        ethers.parseEther("2"),
        latestBlock.timestamp
      ),
      "Deadline must be in the future"
    );
  });

  it("rejects donations after the deadline and reports the campaign as expired", async function () {
    const { ledger, donor } = await deployLedger();
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    await ledger.createCampaignWithDeadline(
      "Community garden",
      "Planting supplies",
      ethers.parseEther("2"),
      deadline
    );
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    await expectRevert(
      ledger.connect(donor).donate(1, { value: ethers.parseEther("1") }),
      "Campaign deadline has passed"
    );

    const status = await ledger.getCampaignStatus(1);
    expect(status.isOpen).to.equal(false);
    expect(status.deadlinePassed).to.equal(true);
  });

  it("reports when the funding goal has been reached", async function () {
    const { ledger, donor } = await deployLedger();
    const latestBlock = await ethers.provider.getBlock("latest");

    await ledger.createCampaignWithDeadline(
      "Community garden",
      "Planting supplies",
      ethers.parseEther("1"),
      latestBlock.timestamp + 3600
    );
    await ledger.connect(donor).donate(1, { value: ethers.parseEther("1") });

    const status = await ledger.getCampaignStatus(1);
    expect(status.isOpen).to.equal(true);
    expect(status.goalReached).to.equal(true);
  });

  it("keeps campaigns created through the original function without a deadline", async function () {
    const { ledger } = await deployLedger();

    await ledger.createCampaign(
      "Community garden",
      "Planting supplies",
      ethers.parseEther("1")
    );

    const campaign = await ledger.getCampaign(1);
    const status = await ledger.getCampaignStatus(1);

    expect(campaign.deadline).to.equal(0n);
    expect(status.isOpen).to.equal(true);
    expect(status.deadlinePassed).to.equal(false);
  });

  it("tracks per-donor contributions and campaign statistics", async function () {
    const { ledger, owner, donor } = await deployLedger();
    const latestBlock = await ethers.provider.getBlock("latest");

    await ledger.createCampaignWithDeadline(
      "Community garden",
      "Planting supplies",
      ethers.parseEther("5"),
      latestBlock.timestamp + 3600
    );
    await ledger.connect(donor).donate(1, { value: ethers.parseEther("1") });
    await ledger.connect(donor).donate(1, { value: ethers.parseEther("3") });
    await ledger.connect(owner).donate(1, { value: ethers.parseEther("2") });

    expect(await ledger.getDonationAmount(1, donor.address)).to.equal(
      ethers.parseEther("4")
    );
    expect(await ledger.getDonationAmount(1, owner.address)).to.equal(
      ethers.parseEther("2")
    );

    const statistics = await ledger.getCampaignStatistics(1);
    expect(statistics.totalRaised).to.equal(ethers.parseEther("6"));
    expect(statistics.goal).to.equal(ethers.parseEther("5"));
    expect(statistics.available).to.equal(ethers.parseEther("6"));
    expect(statistics.donationCount).to.equal(3n);
    expect(statistics.uniqueDonorCount).to.equal(2n);
    expect(statistics.averageDonation).to.equal(ethers.parseEther("2"));
  });

  it("returns zero average donation when a campaign has no donations", async function () {
    const { ledger } = await deployLedger();
    const latestBlock = await ethers.provider.getBlock("latest");

    await ledger.createCampaignWithDeadline(
      "Community garden",
      "Planting supplies",
      ethers.parseEther("1"),
      latestBlock.timestamp + 3600
    );

    const statistics = await ledger.getCampaignStatistics(1);
    expect(statistics.donationCount).to.equal(0n);
    expect(statistics.uniqueDonorCount).to.equal(0n);
    expect(statistics.averageDonation).to.equal(0n);
  });
});
