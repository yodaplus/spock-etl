import { Dictionary, DeepPartial } from 'ts-essentials';
import { Env, getRequiredString, getRequiredNumber } from './utils/configUtils';
import { BlockExtractor, BlockTransformer, Processor } from './processors/types';
import { Services } from './types';

export interface SpockConfig {
  startingBlock: number;
  lastBlock?: number;
  extractors: BlockExtractor[];
  transformers: BlockTransformer[];
  migrations: Dictionary<string>;
  onStart?: (services: Services) => Promise<void>;

  // unique number that will be used to acquire lock on database
  processDbLock: number;
  blockGenerator: {
    batch: number;
  };
  extractorWorker: {
    batch: number;
    reorgBuffer: number;
  };
  transformerWorker: {
    batch: number;
  };
  processorsWorker: {
    retriesOnErrors: number;
  };
  statsWorker: {
    enabled: boolean;
    interval: number; // in minutes
  };
  chain: {
    host: string;
    name: string;
    retries: number;
    alternativeHosts?: string[];
  };
  db: {
    database: string;
    user: string;
    password: string;
    host: string;
    port: number;

    // potentially any setting supported by pg-promise
    [any: string]: any;
  };
  sentry?: {
    dsn: string;
    environment: string;
  };
}

// Config type that should be used as an input for spock. It can have any additional fields (hence & Dictionary<any>)
export type UserProvidedSpockConfig = DeepPartial<SpockConfig> &
  Pick<SpockConfig, 'startingBlock' | 'lastBlock' | 'extractors' | 'transformers' | 'migrations'> &
  Dictionary<any>;

export const getDefaultConfig = (env: Env) => {
  return {
    processDbLock: 0x1337, // unique number that will be used to acquire lock on database
    blockGenerator: {
      batch: 40,
    },
    extractorWorker: {
      batch: 400,
      reorgBuffer: 100, // when to switch off batch processing, set to 0 to turn always process in batches
    },
    transformerWorker: {
      batch: 1000,
    },
    processorsWorker: {
      retriesOnErrors: 10,
    },
    statsWorker: {
      enabled: true,
      interval: 10, // get stats every 10 minutes
    },
    chain: {
      host: getRequiredString(env, 'VL_CHAIN_HOST'),
      name: getRequiredString(env, 'VL_CHAIN_NAME'),
      retries: 15, // retry for ~1 block time ~15 seconds
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

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getAllProcessors(config: SpockConfig): Processor[] {
  return [...config.extractors, ...config.transformers];
}
