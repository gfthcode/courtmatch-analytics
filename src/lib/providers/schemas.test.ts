import { describe, expect, it } from 'vitest';
import { matchupSchema, playerSchema, validateDatasetReferences } from './schemas';

describe('GitHub JSON data contracts',()=>{
  it('accepts a complete NBA player directory record',()=>{
    expect(playerSchema.parse({id:'201939',name:'Stephen Curry',chineseName:'斯蒂芬·库里',aliases:['Curry'],shortName:'Curry',teamId:'gsw',teamName:'Golden State Warriors',teamAbbreviation:'GSW',position:'G',height:'6-2',weight:185,jerseyNumber:'30',headshotUrl:'',league:'NBA'}).id).toBe('201939');
  });
  it('rejects non-NBA matchup rows before they reach the UI',()=>{
    expect(()=>matchupSchema.parse({id:'row-1',offensivePlayerId:'1',defensivePlayerId:'2',season:'2025-26',seasonType:'regular',league:'WNBA',matchupPossessions:12,points:8,fieldGoalAttempts:6,fieldGoalsMade:3,threePointAttempts:2,threePointMade:1,freeThrowAttempts:1,freeThrowsMade:1,turnovers:1,updatedAt:'2026-09-22T00:00:00Z'})).toThrow();
  });
  it('reports duplicate rows and missing player foreign keys',()=>{
    const player={id:'1',name:'A',chineseName:'甲',aliases:[],shortName:'A',teamId:'t',teamName:'Team',teamAbbreviation:'T',position:'G' as const,height:'',weight:0,jerseyNumber:'',headshotUrl:'',league:'NBA' as const};
    const matchup={id:'m',offensivePlayerId:'1',defensivePlayerId:'missing',season:'2025-26',seasonType:'regular' as const,league:'NBA' as const,matchupPossessions:1,points:0,fieldGoalAttempts:0,fieldGoalsMade:0,threePointAttempts:0,threePointMade:0,freeThrowAttempts:0,freeThrowsMade:0,turnovers:0,updatedAt:'2026-09-22T00:00:00Z'};
    const result=validateDatasetReferences({players:[player],teams:[{id:'t',name:'Team',chineseName:'队',abbreviation:'T',logoUrl:''}],matchups:[matchup,matchup],manifest:{provider:'github-json',status:'demo',league:'NBA',lastUpdated:'2026-09-22T00:00:00Z',version:'v',coverage:'demo',players:'players.json',teams:'teams.json',matchups:'matchups.json',playerCount:1,matchupRecordCount:2,isDemo:true}});
    expect(result.valid).toBe(false);expect(result.errors.join(' ')).toContain('missing defensive player');expect(result.errors.join(' ')).toContain('duplicate matchup id');
  });
});
