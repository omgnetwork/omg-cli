import { OMGCLI } from "../../src/omgcli";
import { TestHelper } from "../../src/test_helper";
import { Bot } from "../../src/bot";
const { transaction } = require("@omisego/omg-js-util/src");
const config = require("../../config.js");

jest.setTimeout(2000000);

const omgcli: OMGCLI = new OMGCLI(config);
const testHelder: TestHelper = new TestHelper(omgcli);

test("Start SE for an unspent UTXO", async () => {
  const utxo = await testHelder.getUnspentUTXO(
    omgcli.txOptions.from,
    transaction.ETH_CURRENCY
  );

  if (utxo) {
    // Start IFE
    console.log(utxo);
    const tx = await omgcli.generateTx(omgcli.txOptions.from, utxo.utxo_pos);
    const receiptTx = await omgcli.sendTx(tx);

    expect(receiptTx).toHaveProperty("blknum");
    expect(receiptTx).toHaveProperty("txhash");
    expect(receiptTx).toHaveProperty("txindex");

    console.log(tx);
    const IFEData = await omgcli.getIFEData(tx);
    console.log(IFEData);
    const receiptStartIFE = await omgcli.startIFE(IFEData);
    expect(receiptStartIFE.transactionHash.length).toBeGreaterThan(0);

    // Piggyback Input
    const receiptPiggybackInput = await omgcli.piggybackIFEOnInput(
      IFEData.in_flight_tx,
      0
    );

    expect(receiptPiggybackInput.transactionHash.length).toBeGreaterThan(0);

    // Double spend the same utxo on the plasma chain
    /*
    const tx = await omgcli.generateTx(omgcli.txOptions.from, utxo.utxo_pos);
    const receiptTx = await omgcli.sendTx(tx);

    expect(receiptTx).toHaveProperty("blknum");
    expect(receiptTx).toHaveProperty("txhash");
    expect(receiptTx).toHaveProperty("txindex");

    // Challenge the double spend once it is detected
    const bot = new Bot(omgcli);
    const result = await bot.run(true);

    expect(result.event_name).toBe("invalid_exit");*/
  } else {
    console.log(`Skip test because there are no UTXOs available`);
  }
});
