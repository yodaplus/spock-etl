import { BlockExtractor } from './extractors/extractor';
import { BlockTransformer } from './transformers/transformers';
import { Dictionary, MarkRequired } from 'ts-essentials';
import { Env, getRequiredString, getRequiredNumber } from './utils/configUtils';

export interface SpockConfig {
  startingBlock: number;
  extractors: BlockExtractor[];
  transformers: BlockTransformer[];
  migrations: Dictionary<string>;

  // unique number that will be used to acquire lock on database
  processDbLock: number;
  blockGenerator: {
    batch: number;
  };
  extractorWorker: {
    batch: number;
  };
  transformerWorker: {
    batch: number;
  };
  chain: {
    host: string;
    name: string;
    retries: number;
  };
  db: {
    database: string;
    user: string;
    password: string;
    host: string;
    port: number;
  };
}

export type ExternalVulcan2xConfig = MarkRequired<
  Partial<SpockConfig>,
  'startingBlock' | 'extractors' | 'transformers'
>;

export const getDefaultConfig = (env: Env) => {
  return {
    processDbLock: 0x1337, // unique number that will be used to acquire lock on database
    blockGenerator: {
      batch: 50,
    },
    extractorWorker: {
      batch: 100,
    },
    transformerWorker: {
      batch: 1000,
    },
    chain: {
      host: getRequiredString(env, 'VL_CHAIN_HOST'),
      name: getRequiredString(env, 'VL_CHAIN_NAME'),
      retries: 50, // retry for ~50 seconds
    },
    db: {
      database: getRequiredString(env, 'VL_DB_DATABASE'),
      user: getRequiredString(env, 'VL_DB_USER'),
      password: getRequiredString(env, 'VL_DB_PASSWORD'),
      host: getRequiredString(env, 'VL_DB_HOST'),
      port: getRequiredNumber(env, 'VL_DB_PORT'),
    },
  };
};
