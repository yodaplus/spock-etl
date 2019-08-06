import { getLast } from '../../../utils';
import { min, max, groupBy, uniqBy } from 'lodash';
import { Log } from 'ethers/providers';
import { TransactionalServices, LocalServices } from '../../../types';
import { BlockModel } from '../../../db/models/Block';
import { BlockExtractor } from '../../types';
import { getOrCreateTx } from '../common';
import { timer } from '../../../utils/timer';

export function makeRawLogExtractors(_addresses: string[]): BlockExtractor[] {
  const addresses = _addresses.map(a => a.toLowerCase());

  return addresses.map(address => ({
    name: getExtractorName(address),
    address,
    async extract(services: TransactionalServices, blocks: BlockModel[]): Promise<void> {
      const wholeExtractTimer = timer('whole-extract');

      const gettingLogs = timer('getting-logs');
      const logs = await getLogs(services, blocks, address);
      gettingLogs();

      const processingLogs = timer(`processing-logs`, `with: ${logs.length}`);

      const blocksByHash = groupBy(blocks, 'hash');
      const allTxs = uniqBy(
        logs.map(l => ({ txHash: l.transactionHash!, blockHash: l.blockHash! })),
        'txHash',
      );
      const allStoredTxs = await Promise.all(
        allTxs.map(tx => getOrCreateTx(services, tx.txHash, blocksByHash[tx.blockHash][0])),
      );
      const allStoredTxsByTxHash = groupBy(allStoredTxs, 'hash');

      const logsToInsert = (await Promise.all(
        logs.map(async log => {
          const _block = blocksByHash[log.blockHash!];
          if (!_block) {
            return;
          }
          const block = _block[0];
          const storedTx = allStoredTxsByTxHash[log.transactionHash!][0];

          return {
            ...log,
            address: log.address.toLowerCase(), // always use lower case
            log_index: log.logIndex,
            block_id: block.id,
            tx_id: storedTx.id,
          };
        }),
      )).filter(log => !!log);
      processingLogs();

      if (logsToInsert.length !== 0) {
        const addingLogs = timer(`adding-logs`, `with: ${logsToInsert.length} logs`);
        const query = services.pg.helpers.insert(
          logsToInsert,
          services.columnSets['extracted_logs'],
        );
        await services.tx.none(query);
        addingLogs();
      }

      wholeExtractTimer();
    },

    async getData(services: LocalServices, blocks: BlockModel[]): Promise<any> {
      return await getRawLogs(services, address, blocks);
    },
  }));
}

export async function getRawLogs(
  services: LocalServices,
  address: string,
  blocks: BlockModel[],
): Promise<any[]> {
  const blocksIds = blocks.map(b => b.id);
  const minId = min(blocksIds);
  const maxId = max(blocksIds);

  return (
    (await services.tx.manyOrNone(
      `
SELECT * FROM extracted.logs 
WHERE logs.block_id >= \${id_min} AND logs.block_id <= \${id_max} AND address=\${address};
  `,
      {
        address,
        id_min: minId,
        id_max: maxId,
      },
    )) || []
  );
}

export function getExtractorName(address: string): string {
  return `raw_log_${address.toLowerCase()}_extractor`;
}

export interface PersistedLog {
  block_id: number;
  tx_id: number;
  log_index: number;
  address: string;
  data: string;
  topics: string;
}

export async function getLogs(
  services: TransactionalServices,
  blocks: BlockModel[],
  address: string,
): Promise<Log[]> {
  if (blocks.length === 0) {
    return [];
  } else if (blocks.length === 1) {
    return await services.provider.getLogs({
      address,
      blockHash: blocks[0].hash,
    });
  } else {
    const fromBlock = blocks[0].number;
    const toBlock = getLast(blocks)!.number;

    return await services.provider.getLogs({
      address,
      fromBlock,
      toBlock,
    });
  }
}