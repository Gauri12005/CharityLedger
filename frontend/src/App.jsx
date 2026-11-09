import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "ethers";
import { connectReadOnly, connectWallet } from "./contract";
import "./App.css";

function toLocalDateTime(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function App() {
  const [wallet, setWallet] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [donations, setDonations] = useState([]);
  const [donationReceipt, setDonationReceipt] = useState(null);
  const [highlightedTransaction] = useState(() =>
    new URLSearchParams(window.location.search).get("tx")?.toLowerCase() || ""
  );
  const [trackerError, setTrackerError] = useState("");
  const [trackerLoading, setTrackerLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [minimumDeadline] = useState(() =>
    toLocalDateTime(new Date(Date.now() + 60_000))
  );

  const [donationAmounts, setDonationAmounts] = useState({});
  const [withdrawAmounts, setWithdrawAmounts] = useState({});

  const loadCampaigns = useCallback(async (contract) => {
    const count = await contract.campaignCount();
    const items = [];

    for (let id = 1n; id <= count; id++) {
      const c = await contract.getCampaign(id);
      const status = await contract.getCampaignStatus(id);

      items.push({
        id: Number(c.id),
        owner: c.owner,
        title: c.title,
        description: c.description,
        goal: c.goal,
        raised: c.raised,
        withdrawn: c.withdrawn,
        active: c.active,
        deadline: c.deadline,
        isOpen: status.isOpen,
        deadlinePassed: status.deadlinePassed,
        goalReached: status.goalReached,
        statistics: await contract.getCampaignStatistics(id),
      });
    }

    setCampaigns(items.reverse());
  }, []);

  const leaderboard = useMemo(() => {
    const totals = new Map();
    for (const donation of donations) {
      const address = donation.donor.toLowerCase();
      const current = totals.get(address);
      totals.set(address, {
        address: donation.donor,
        total: (current?.total || 0n) + donation.amount,
        donations: (current?.donations || 0) + 1,
      });
    }

    return [...totals.values()]
      .sort((a, b) =>
        a.total === b.total ? a.address.localeCompare(b.address) : a.total > b.total ? -1 : 1
      )
      .slice(0, 10);
  }, [donations]);

  const totalDonated = useMemo(
    () => donations.reduce((sum, donation) => sum + donation.amount, 0n),
    [donations]
  );
  const uniqueDonorCount = useMemo(
    () => new Set(donations.map((donation) => donation.donor.toLowerCase())).size,
    [donations]
  );
  const averageDonation =
    donations.length === 0 ? 0n : totalDonated / BigInt(donations.length);

  useEffect(() => {
    if (!wallet) return undefined;

    const intervalId = window.setInterval(() => {
      loadCampaigns(wallet.contract).catch((err) => {
        setError(
          err.shortMessage || err.message || "Could not refresh campaign status."
        );
      });
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [wallet, loadCampaigns]);

  const loadDonations = useCallback(async (contract, provider) => {
    const events = await contract.queryFilter(
      contract.filters.DonationReceived(),
      0,
      "latest"
    );
    const blockNumbers = [...new Set(events.map((event) => event.blockNumber))];
    const blocks = await Promise.all(
      blockNumbers.map((blockNumber) => provider.getBlock(blockNumber))
    );
    const blockTimestamps = new Map(
      blocks.map((block) => {
        if (!block) {
          throw new Error("Could not load a donation's block timestamp.");
        }
        return [block.number, Number(block.timestamp) * 1000];
      })
    );
    const items = events.map((event) => ({
      campaignId: Number(event.args.campaignId),
      donor: event.args.donor,
      amount: event.args.amount,
      transactionHash: event.transactionHash,
      timestamp: blockTimestamps.get(event.blockNumber),
      blockNumber: event.blockNumber,
      logIndex: event.index,
    }));

    items.sort(
      (a, b) =>
        b.blockNumber - a.blockNumber || b.logIndex - a.logIndex
    );
    setDonations(items);
    setTrackerError("");
    return items;
  }, []);

  const showDonationReceipt = useCallback(async (donation) => {
    const { default: QRCode } = await import("qrcode");
    const receiptUrl = new URL(window.location.href);
    receiptUrl.searchParams.set("tx", donation.transactionHash);
    receiptUrl.hash = "donation-history";
    const qrCode = await QRCode.toDataURL(receiptUrl.toString(), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 200,
    });

    setDonationReceipt({ ...donation, qrCode });
  }, []);

  useEffect(() => {
    if (!highlightedTransaction) return undefined;

    const timeoutId = window.setTimeout(() => {
      const donation = donations.find(
        (item) =>
          item.transactionHash.toLowerCase() === highlightedTransaction
      );
      if (donation) {
        showDonationReceipt(donation).catch((err) => {
          setError(err.message || "Could not generate the donation receipt.");
        });
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [donations, highlightedTransaction, showDonationReceipt]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicDonations = async () => {
      try {
        const { provider, contract } = await connectReadOnly();
        await Promise.all([
          loadCampaigns(contract),
          loadDonations(contract, provider),
        ]);
      } catch (err) {
        if (!cancelled) {
          setTrackerError(
            err.shortMessage || err.message || "Could not load donation history."
          );
        }
      } finally {
        if (!cancelled) setTrackerLoading(false);
      }
    };

    loadPublicDonations();
    return () => {
      cancelled = true;
    };
  }, [loadCampaigns, loadDonations]);

  const handleConnect = async () => {
    setError("");
    setMessage("");

    try {
      setLoading(true);
      const connection = await connectWallet();
      setWallet(connection);
      await loadCampaigns(connection.contract);
      await loadDonations(connection.contract, connection.provider);
      setMessage("Wallet connected successfully!");
    } catch (err) {
      setError(err.shortMessage || err.message || "Unable to connect wallet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      setWallet(null);
      setCampaigns([]);
      setMessage("Wallet account changed. Please reconnect.");
    };

    const handleChainChanged = () => {
      setWallet(null);
      setCampaigns([]);
      setMessage("Network changed. Reconnect to Hardhat Local.");
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const handleCreateCampaign = async (event) => {
    event.preventDefault();
    if (!wallet) return;

    const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
    if (!Number.isFinite(deadlineTimestamp) || deadlineTimestamp <= Date.now() / 1000) {
      setError("Choose a campaign deadline in the future.");
      return;
    }

    setError("");
    setMessage("");

    try {
      setLoading(true);

      const tx = await wallet.contract.createCampaignWithDeadline(
        title.trim(),
        description.trim(),
        parseEther(goal),
        deadlineTimestamp
      );

      setMessage("Waiting for transaction confirmation...");
      await tx.wait();

      setTitle("");
      setDescription("");
      setGoal("");
      setDeadline("");

      await loadCampaigns(wallet.contract);
      setMessage("Campaign created successfully!");
    } catch (err) {
      setError(err.shortMessage || err.message || "Could not create campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = async (id) => {
    if (!wallet) return;

    const amount = donationAmounts[id];
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid donation amount.");
      return;
    }

    setError("");
    setMessage("");

    let confirmed = false;
    let confirmedTransactionHash = "";
    try {
      setLoading(true);

      const tx = await wallet.contract.donate(id, {
        value: parseEther(amount),
      });
      confirmedTransactionHash = tx.hash;

      setMessage("Confirming your donation...");
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("The donation was not confirmed on the blockchain.");
      }
      confirmed = true;

      const eventTopic = wallet.contract.interface.getEvent(
        "DonationReceived"
      ).topicHash;
      const donationLog = receipt.logs.find(
        (log) => log.topics[0] === eventTopic
      );
      const parsedEvent = donationLog
        ? wallet.contract.interface.parseLog(donationLog)
        : null;
      if (!parsedEvent) {
        throw new Error(
          "The donation was confirmed, but its on-chain event was not found."
        );
      }

      const block = await wallet.provider.getBlock(receipt.blockNumber);
      if (!block) {
        throw new Error(
          "The donation was confirmed, but its block timestamp could not be loaded."
        );
      }

      const confirmedDonation = {
        campaignId: Number(parsedEvent.args.campaignId),
        donor: parsedEvent.args.donor,
        amount: parsedEvent.args.amount,
        transactionHash: receipt.hash,
        timestamp: Number(block.timestamp) * 1000,
        blockNumber: receipt.blockNumber,
        logIndex: donationLog.index,
      };
      await showDonationReceipt(confirmedDonation);

      setDonationAmounts((prev) => ({ ...prev, [id]: "" }));
      const refreshResults = await Promise.allSettled([
        loadCampaigns(wallet.contract),
        loadDonations(wallet.contract, wallet.provider),
      ]);
      const failedRefresh = refreshResults.find(
        (result) => result.status === "rejected"
      );
      setMessage(
        `Donation confirmed in transaction ${receipt.hash}. Your receipt is ready.`
      );
      if (failedRefresh) {
        const refreshError = failedRefresh.reason;
        setError(
          `Donation confirmed, but the campaign or donation list could not refresh: ${refreshError?.shortMessage || refreshError?.message || String(refreshError)}`
        );
      }
    } catch (err) {
      const detail = err.shortMessage || err.message || "Unknown error";
      setError(
        confirmed
          ? `Donation confirmed (${confirmedTransactionHash}), but receipt generation failed: ${detail}`
          : detail
      );
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (campaign) => {
    if (!wallet) return;

    const amount = withdrawAmounts[campaign.id];
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid withdrawal amount.");
      return;
    }

    setError("");
    setMessage("");

    try {
      setLoading(true);

      const tx = await wallet.contract.withdraw(
        campaign.id,
        parseEther(amount)
      );

      setMessage("Confirming withdrawal...");
      await tx.wait();

      setWithdrawAmounts((prev) => ({
        ...prev,
        [campaign.id]: "",
      }));

      await loadCampaigns(wallet.contract);
      await loadDonations(wallet.contract, wallet.provider);
      setMessage("Funds withdrawn successfully!");
    } catch (err) {
      setError(err.shortMessage || err.message || "Withdrawal failed.");
    } finally {
      setLoading(false);
    }
  };

  const refreshCampaigns = async () => {
    try {
      setLoading(true);
      if (wallet) {
        await loadCampaigns(wallet.contract);
        await loadDonations(wallet.contract, wallet.provider);
        setMessage("Campaigns and donation history refreshed.");
      } else {
        const { provider, contract } = await connectReadOnly();
        await loadCampaigns(contract);
        await loadDonations(contract, provider);
        setMessage("Campaigns and donation history refreshed.");
      }
      setError("");
    } catch (err) {
      const detail = err.shortMessage || err.message || "Unknown error";
      setTrackerError(detail);
      setError(`Could not refresh on-chain data: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const shortAddress = (address) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">C</span>
          CharityLedger
        </a>

        <button
          className="wallet-button"
          onClick={handleConnect}
          disabled={loading}
        >
          {wallet ? shortAddress(wallet.account) : "Connect MetaMask"}
        </button>
      </header>

      <main>
        <section className="hero" id="home">
          <span className="eyebrow">TRANSPARENT GIVING · BLOCKCHAIN POWERED</span>
          <h1>Small acts. <span>Real impact.</span></h1>
          <p>
            Discover causes you care about, donate transparently, and track
            campaign funds on the blockchain.
          </p>

          {!wallet && (
            <button className="primary-button" onClick={handleConnect}>
              Connect Wallet to Get Started
            </button>
          )}

          {wallet && (
            <div className="connected-pill">
              <span className="status-dot" />
              Connected: {shortAddress(wallet.account)}
            </div>
          )}
        </section>

        {(message || error) && (
          <div className={`notice ${error ? "error" : "success"}`}>
            {error || message}
            <button
              className="notice-close"
              onClick={() => {
                setMessage("");
                setError("");
              }}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section className="stats">
          <div className="stat-card">
            <span>Campaigns</span>
            <strong>{campaigns.length}</strong>
          </div>
          <div className="stat-card">
            <span>Total donations received</span>
            <strong>
              {totalDonated === 0n
                ? "0"
                : Number(
                    formatEther(totalDonated)
                  ).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              {" ETH"}
            </strong>
          </div>
          <div className="stat-card">
            <span>Average donation</span>
            <strong>
              {Number(formatEther(averageDonation)).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              ETH
            </strong>
          </div>
          <div className="stat-card">
            <span>Unique contributors</span>
            <strong>{uniqueDonorCount}</strong>
          </div>
          <div className="stat-card">
            <span>Network</span>
            <strong className="network-label">Hardhat Local</strong>
          </div>
        </section>

        <section className="leaderboard-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COMMUNITY SUPPORT</span>
              <h2>Top contributors</h2>
              <p>Ranked by total confirmed donations recorded on-chain.</p>
            </div>
          </div>
          {leaderboard.length === 0 ? (
            <div className="empty-state">
              <p>Contributor rankings will appear after the first donation.</p>
            </div>
          ) : (
            <div className="leaderboard-list">
              {leaderboard.map((contributor, index) => (
                <article
                  className="leaderboard-row"
                  key={contributor.address.toLowerCase()}
                >
                  <span className="leaderboard-rank">#{index + 1}</span>
                  <div className="leaderboard-contributor">
                    <strong>{shortAddress(contributor.address)}</strong>
                    <span>
                      {contributor.donations}{" "}
                      {contributor.donations === 1 ? "donation" : "donations"}
                    </span>
                  </div>
                  <strong className="leaderboard-total">
                    {Number(formatEther(contributor.total)).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 4 }
                    )}{" "}
                    ETH
                  </strong>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="create-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MAKE A DIFFERENCE</span>
              <h2>Start a campaign</h2>
              <p>Share your cause and let the community support it.</p>
            </div>
          </div>

          <form className="campaign-form" onSubmit={handleCreateCampaign}>
            <label>
              Campaign title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Support a local school"
                maxLength={100}
                required
              />
            </label>

            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain your cause and how funds will help..."
                rows={3}
              />
            </label>

            <label>
              Funding goal (ETH)
              <input
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="0.5"
                min="0.000000000000000001"
                step="any"
                required
              />
            </label>

            <label>
              Campaign deadline
              <input
                type="datetime-local"
                value={deadline}
                min={minimumDeadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </label>

            <button
              className="primary-button"
              type="submit"
              disabled={!wallet || loading}
            >
              {loading ? "Please wait..." : "＋ Create Campaign"}
            </button>

            {!wallet && (
              <small>Connect MetaMask before creating a campaign.</small>
            )}
          </form>
        </section>

        <section className="campaign-section">
          <div className="section-heading campaign-heading">
            <div>
              <span className="eyebrow">COMMUNITY IMPACT</span>
              <h2>Explore campaigns</h2>
              <p>Every donation is recorded through a blockchain transaction.</p>
            </div>

            <button
              className="secondary-button"
              onClick={refreshCampaigns}
              disabled={loading || trackerLoading}
            >
              ↻ Refresh
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">♡</div>
              <h3>No campaigns yet</h3>
              <p>Create the first campaign and make a difference.</p>
            </div>
          ) : (
            <div className="campaign-grid">
              {campaigns.map((campaign) => {
                const available = campaign.raised - campaign.withdrawn;
                const progress =
                  campaign.goal > 0n
                    ? Math.min(
                        100,
                        Number((campaign.raised * 100n) / campaign.goal)
                      )
                    : 0;
                const isOwner =
                  wallet?.account.toLowerCase() === campaign.owner.toLowerCase();
                const campaignStatus = campaign.deadlinePassed
                  ? "Expired"
                  : campaign.isOpen
                    ? "Active"
                    : "Closed";

                return (
                  <article className="campaign-card" key={campaign.id}>
                    <div className="card-topline">
                      <span className="campaign-tag">COMMUNITY CAMPAIGN</span>
                      <span className="campaign-id">#{campaign.id}</span>
                    </div>

                    <div
                      className={`campaign-status ${
                        campaign.deadlinePassed
                          ? "expired"
                          : campaign.goalReached
                            ? "goal-reached"
                            : "active"
                      }`}
                    >
                      {campaignStatus}
                    </div>
                    <div
                      className={`campaign-status ${
                        campaign.goalReached ? "goal-reached" : "goal-pending"
                      }`}
                    >
                      {campaign.goalReached ? "Goal reached" : "Goal not reached"}
                    </div>

                    <h3>{campaign.title}</h3>
                    <p className="campaign-description">
                      {campaign.description || "No description provided."}
                    </p>

                    <div className="owner-line">
                      Created by <span>{shortAddress(campaign.owner)}</span>
                    </div>

                    <div className="deadline-line">
                      Deadline
                      <strong>
                        {campaign.deadline === 0n
                          ? "No deadline"
                          : new Date(
                              Number(campaign.deadline) * 1000
                            ).toLocaleString()}
                      </strong>
                    </div>

                    <div className="progress-label">
                      <span>Funds raised</span>
                      <strong>{progress}%</strong>
                    </div>

                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="funding-numbers">
                      <div>
                        <strong>{Number(formatEther(campaign.raised)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH</strong>
                        <span>Raised</span>
                      </div>
                      <div>
                        <strong>{Number(formatEther(campaign.goal)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH</strong>
                        <span>Goal</span>
                      </div>
                    </div>

                    <div className="campaign-statistics">
                      <h4>Campaign statistics</h4>
                      <div>
                        <span>Donation transactions</span>
                        <strong>
                          {campaign.statistics.donationCount.toString()}
                        </strong>
                      </div>
                      <div>
                        <span>Unique contributors</span>
                        <strong>
                          {campaign.statistics.uniqueDonorCount.toString()}
                        </strong>
                      </div>
                      <div>
                        <span>Average donation</span>
                        <strong>
                          {Number(
                            formatEther(campaign.statistics.averageDonation)
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}{" "}
                          ETH
                        </strong>
                      </div>
                    </div>

                    <div className="available-line">
                      Available to withdraw
                      <strong>
                        {Number(formatEther(available)).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 4 }
                        )}{" "}
                        ETH
                      </strong>
                    </div>

                    <div className="card-actions">
                      <label>
                        Donation amount (ETH)
                        <input
                          type="number"
                          min="0.000000000000000001"
                          step="any"
                          placeholder="0.01"
                          value={donationAmounts[campaign.id] || ""}
                          onChange={(e) =>
                            setDonationAmounts((prev) => ({
                              ...prev,
                              [campaign.id]: e.target.value,
                            }))
                          }
                        />
                      </label>

                      <button
                        className="primary-button full-button"
                        onClick={() => handleDonate(campaign.id)}
                        disabled={!wallet || loading || !campaign.isOpen}
                      >
                        {campaign.deadlinePassed ? "Campaign ended" : "Donate ETH"}
                      </button>

                      {isOwner && (
                        <div className="withdraw-panel">
                          <span className="owner-badge">You own this campaign</span>
                          <label>
                            Withdrawal amount (ETH)
                            <input
                              type="number"
                              min="0.000000000000000001"
                              step="any"
                              placeholder="0.01"
                              value={withdrawAmounts[campaign.id] || ""}
                              onChange={(e) =>
                                setWithdrawAmounts((prev) => ({
                                  ...prev,
                                  [campaign.id]: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="secondary-button full-button"
                            onClick={() => handleWithdraw(campaign)}
                            disabled={loading || available === 0n}
                          >
                            Withdraw Funds
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="donation-history-section" id="donation-history">
          <div className="section-heading campaign-heading">
            <div>
              <span className="eyebrow">ON-CHAIN TRANSPARENCY</span>
              <h2>Public donation tracker</h2>
              <p>
                Every record is read from the CharityLedger donation events on
                Hardhat Local.
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={refreshCampaigns}
              disabled={loading || trackerLoading}
            >
              ↻ Refresh history
            </button>
          </div>

          {trackerError && (
            <div className="tracker-error" role="alert">
              Could not load on-chain donation history: {trackerError}
            </div>
          )}

          {donationReceipt && (
            <article className="receipt-card">
              <div>
                <span className="eyebrow">BLOCKCHAIN DONATION RECEIPT</span>
                <h3>Donation confirmed</h3>
                <dl className="receipt-details">
                  <div>
                    <dt>Amount</dt>
                    <dd>{formatEther(donationReceipt.amount)} ETH</dd>
                  </div>
                  <div>
                    <dt>Campaign</dt>
                    <dd>#{donationReceipt.campaignId}</dd>
                  </div>
                  <div>
                    <dt>Donor</dt>
                    <dd>{donationReceipt.donor}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{new Date(donationReceipt.timestamp).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Transaction hash</dt>
                    <dd className="receipt-hash">
                      <a
                        href={`/?tx=${encodeURIComponent(donationReceipt.transactionHash)}#donation-history`}
                      >
                        {donationReceipt.transactionHash}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="receipt-qr">
                <img src={donationReceipt.qrCode} alt="QR code for this donation receipt" />
                <span>Scan to open and verify this transaction in the tracker.</span>
              </div>
            </article>
          )}

          {trackerLoading ? (
            <div className="empty-state">
              <p>Loading donation history from the blockchain...</p>
            </div>
          ) : donations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⌁</div>
              <h3>No donations recorded yet</h3>
              <p>Confirmed donations will appear here with their transaction details.</p>
            </div>
          ) : (
            <div className="donation-list">
              {donations.map((donation) => (
                <article
                  className={`donation-row ${
                    highlightedTransaction === donation.transactionHash.toLowerCase()
                      ? "highlighted"
                      : ""
                  }`}
                  key={`${donation.transactionHash}-${donation.logIndex}`}
                >
                  <div className="donation-row-main">
                    <div className="donation-row-heading">
                      <strong>{formatEther(donation.amount)} ETH</strong>
                      <span>Campaign #{donation.campaignId}</span>
                    </div>
                    <dl className="donation-meta">
                      <div>
                        <dt>Donor</dt>
                        <dd>{donation.donor}</dd>
                      </div>
                      <div>
                        <dt>Transaction</dt>
                        <dd className="transaction-hash">
                          <a
                            href={`/?tx=${encodeURIComponent(donation.transactionHash)}#donation-history`}
                          >
                            {donation.transactionHash}
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt>Date</dt>
                        <dd>{new Date(donation.timestamp).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    className="secondary-button receipt-button"
                    onClick={() =>
                      showDonationReceipt(donation).catch((err) =>
                        setError(
                          err.message || "Could not generate the donation receipt."
                        )
                      )
                    }
                  >
                    View receipt
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="trust-section">
          <div className="trust-icon">✓</div>
          <div>
            <h3>Built for transparency</h3>
            <p>
              Campaign creation, donations, and withdrawals are processed by
              smart-contract transactions on your local Ethereum-compatible
              blockchain.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#home">
          <span className="brand-icon">C</span>
          CharityLedger
        </a>
        <p>Transparent giving, powered by blockchain.</p>
        <span>Educational demo · Hardhat Local</span>
      </footer>
    </div>
  );
}

export default App;