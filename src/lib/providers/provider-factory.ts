import type { BasketballDataProvider } from './contracts';
import { GithubJsonProvider } from './github-json-provider';
import { MockProvider } from './mock-provider';

export async function createDataProvider():Promise<BasketballDataProvider>{
 const mode=import.meta.env.VITE_DATA_MODE?.trim()||'auto';
 if(mode==='demo')return new MockProvider('已在设置中选择内置演示数据。');
 const base=import.meta.env.VITE_GITHUB_DATA_BASE_URL?.trim()||`${import.meta.env.BASE_URL}data`;
 const github=new GithubJsonProvider(base);
 try{const status=await github.getDataStatus();if(status.isDemo)return new MockProvider('标准化 GitHub manifest 仍标记为演示数据；已使用内置演示数据。');return github;}catch(error){if(mode==='live')throw error;return new MockProvider(`标准化 GitHub 数据暂不可用：${error instanceof Error?error.message:'unknown error'}。已切换到演示数据。`);}
}
