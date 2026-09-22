import { readFile } from 'node:fs/promises';
const base=new URL('../data/',import.meta.url);const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
for(const key of ['provider','status','league','lastUpdated','version','players','teams','matchups'])if(!(key in manifest))throw new Error(`manifest missing ${key}`);
if(manifest.league!=='NBA')throw new Error('CourtMatch accepts NBA data only');
console.log(`Validated ${manifest.provider} ${manifest.status} manifest ${manifest.version}`);
