import type { Dataset } from './types';
import { createDataProvider } from './providers/provider-factory';
import type { DataStatus } from './providers/contracts';

export type LoadedDataset={dataset:Dataset;status:DataStatus};
export async function loadDataset():Promise<LoadedDataset>{const provider=await createDataProvider();return {dataset:await provider.getDataset(),status:await provider.getDataStatus()};}
