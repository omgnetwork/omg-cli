import { OMGCLI } from "../src/omgcli";
const { transaction } = require("@omisego/omg-js-util/src");
const config = require("../config.js");

jest.setTimeout(200000);

const bobTxOptions = {
  privateKey: config.bob_eth_address_private_key,
  from: config.bob_eth_address,
  gas: 6000000,
  gasPrice: "8000000000"
};

let omgcli: OMGCLI;
let processingUTXOPos: number[] = [];

beforeEach(() => {
  omgcli = new OMGCLI(config);
});

/*
 * General functions
 */

test("Get the Min Exit Period from the PlasmaFramework", async () => {
  const response = await omgcli.getExitPeriod();

  expect(Number(response)).toBeGreaterThan(0);
});

test("Get events", async () => {
  const response = await omgcli.getStatus();
  expect(response.byzantine_events).toBeInstanceOf(Array);
});

test("Get exit queue for ETH", async () => {
  const response = await omgcli.getExitQueue(transaction.ETH_CURRENCY);
  expect(response).toBeInstanceOf(Array);
});

test("Get fees", async () => {
  const response = await omgcli.getFees();
  const firstFeeEntry = response["1"][0];

  expect(firstFeeEntry).toHaveProperty("amount");
  expect(firstFeeEntry).toHaveProperty("currency");
  expect(firstFeeEntry).toHaveProperty("subunit_to_unit");
});

test("Process exits for ETH", async () => {
  const queue = await omgcli.getExitQueue(transaction.ETH_CURRENCY);

  if (queue.length) {
    const receiptProcessExits = await omgcli.processExits(
      transaction.ETH_CURRENCY
    );
    expect(receiptProcessExits.transactionHash.length).toBeGreaterThan(0);
  } else {
    console.log(`Skipping test as the queue is empty`);
  }
});

/*
 * Plasma specific functions
 */

test("Get UTXOs for an address", async () => {
  const response = await omgcli.getUTXOs(config.alice_eth_address);

  if (response.length) {
    const utxo = response[0];
    expect(utxo).toHaveProperty("amount");
    expect(utxo).toHaveProperty("currency");
    expect(utxo).toHaveProperty("oindex");
    expect(utxo).toHaveProperty("txindex");
    expect(utxo).toHaveProperty("utxo_pos");
    expect(utxo).toHaveProperty("owner");
  }
});

test("Get balance for an address", async () => {
  const response = await omgcli.getBalance(config.alice_eth_address);

  if (response.length) {
    const utxo = response[0];
    expect(utxo).toHaveProperty("amount");
    expect(utxo).toHaveProperty("currency");
  } else {
    console.log(`Skipping test as there is no balance for the account`);
  }
});

test("Generate tx from utxo", async () => {
  const utxo = await getUnspentUTXO(
    omgcli.txOptions.from,
    transaction.ETH_CURRENCY
  );

  const tx = await omgcli.generateTx(omgcli.txOptions.from, utxo.utxo_pos);

  expect(tx).toHaveProperty("transactionType");
  expect(tx).toHaveProperty("inputs");
  expect(tx).toHaveProperty("outputs");
  expect(tx).toHaveProperty("metadata");
});

test("Send a tx on the plasma chain", async () => {
  const utxo = await getUnspentUTXO(
    omgcli.txOptions.from,
    transaction.ETH_CURRENCY
  );

  const tx = await omgcli.generateTx(omgcli.txOptions.from, utxo.utxo_pos);

  const receiptTx = await omgcli.sendTx(tx);
  expect(receiptTx).toHaveProperty("blknum");
  expect(receiptTx).toHaveProperty("txhash");
  expect(receiptTx).toHaveProperty("txindex");
});

/*
 * SE functions
 */
test("Get SE data for an unspent UTXO", async () => {
  const utxo = await getUnspentUTXO(
    omgcli.txOptions.from,
    transaction.ETH_CURRENCY
  );

  const SEData = await omgcli.getSEData(utxo.utxo_pos);
  expect(SEData).toHaveProperty("proof");
  expect(SEData).toHaveProperty("txbytes");
  expect(SEData).toHaveProperty("utxo_pos");
});

test("Start SE for an unspent UTXO", async () => {
  const utxo = await getUnspentUTXO(
    omgcli.txOptions.from,
    transaction.ETH_CURRENCY
  );

  const SEData = await omgcli.getSEData(utxo.utxo_pos);

  const receiptSE = await omgcli.startSE(SEData);

  expect(receiptSE.transactionHash.length).toBeGreaterThan(0);
});

test.only("Challenge SE for an inactive exit should fail", async () => {
  const utxo = await getUnspentUTXO(
    omgcli.txOptions.from,
    transaction.ETH_CURRENCY
  );

  try {
    await omgcli.getSEChallengeData(utxo.utxo_pos);
  } catch (err) {
    expect(err).toEqual(
      new Error(
        "The challenge of particular exit is impossible because exit is inactive or missing"
      )
    );
  }
});
/*
 * Helper functions
 */
async function getUnspentUTXO(owner: String, currency: String) {
  const ret = await omgcli.getUTXOs(owner);

  for (const utxo of ret) {
    if (!processingUTXOPos.includes(utxo.utxo_pos)) {
      processingUTXOPos.push(utxo.utxo_pos);
      if (currency) {
        const amount = await omgcli.getFee(currency);
        if (utxo.currency == currency && utxo.amount > amount) {
          return utxo;
        }
      } else {
        return utxo;
      }
    }
  }
  throw "No unspent UTXO found. Aborting test run.";
}
