import {
  makeRawLogExtractors,
  getExtractorName,
} from '../../processors/extractors/instances/rawEventDataExtractor';
import { join } from 'path';
import { pick, omit, sortBy, flatten } from 'lodash';
import { BlockTransformer } from '../../processors/types';
import { runIntegrationTest, withLocalEnv } from '../../../test/common-utils';
import { dumpDB } from '../../../test/common';

const DAI = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';

let allDaiData: any = [];
const daiTransformer: BlockTransformer = {
  name: 'DAI-transformer',
  dependencies: [getExtractorName(DAI)],
  transform: async (_s, data) => {
    const deterministicData = flatten(data).map(d => omit(d, 'tx_id'));
    allDaiData.push(...deterministicData);
  },
};

describe('Spock ETL', () => {
  it('should work for past events', async () => {
    jest.setTimeout(1000 * 60);

    const startingBlock = 8219360;

    await withLocalEnv(join(__dirname, '../../../../'), async () => {
      const db = await runIntegrationTest({
        startingBlock,
        lastBlock: startingBlock + 40,
        extractors: [...makeRawLogExtractors([DAI])],
        transformers: [daiTransformer],
        migrations: {},
      });
      const dump = await dumpDB(db);

      expect(pick(dump, ['blocks', 'extracted_logs'])).toMatchSnapshot();
      expect(sortBy(allDaiData, ['block_id', 'log_index'])).toMatchSnapshot();
    });
  });
});
