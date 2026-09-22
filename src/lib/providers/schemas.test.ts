import { describe, expect, it } from 'vitest';
import { matchupSchema, playerSchema } from './schemas';

describe('GitHub JSON data contracts',()=>{
  it('accepts a complete NBA player directory record',()=>{
    expect(playerSchema.parse({id:'201939',name:'Stephen Curry',chineseName:'斯蒂芬·库里',aliases:['Curry'],shortName:'Curry',teamId:'gsw',teamName:'Golden State Warriors',teamAbbreviation:'GSW',position:'G',height:'6-2',weight:185,jerseyNumber:'30',headshotUrl:'',league:'NBA'}).id).toBe('201939');
  });
  it('rejects non-NBA matchup rows before they reach the UI',()=>{
    expect(()=>matchupSchema.parse({id:'row-1',offensivePlayerId:'1',defensivePlayerId:'2',season:'2025-26',seasonType:'regular',league:'WNBA',matchupPossessions:12,points:8,fieldGoalAttempts:6,fieldGoalsMade:3,threePointAttempts:2,threePointMade:1,freeThrowAttempts:1,freeThrowsMade:1,turnovers:1,updatedAt:'2026-09-22T00:00:00Z'})).toThrow();
  });
});
