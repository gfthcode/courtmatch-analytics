import { z } from 'zod';

const league=z.literal('NBA');
const seasonType=z.enum(['regular','playoffs']);
const numeric=z.number().finite();

export const playerSchema=z.object({id:z.string().min(1),name:z.string().min(1),chineseName:z.string().min(1),aliases:z.array(z.string()),shortName:z.string().min(1),teamId:z.string().min(1),teamName:z.string().min(1),teamAbbreviation:z.string().min(1),position:z.enum(['G','F','C','G-F','F-C']),height:z.string(),weight:numeric,jerseyNumber:z.string(),headshotUrl:z.string(),league});
export const teamSchema=z.object({id:z.string().min(1),name:z.string().min(1),chineseName:z.string().min(1),abbreviation:z.string().min(1),logoUrl:z.string()});
export const matchupSchema=z.object({id:z.string().min(1),offensivePlayerId:z.string().min(1),defensivePlayerId:z.string().min(1),season:z.string().min(1),seasonType,league,matchupPossessions:numeric.nonnegative(),points:numeric,fieldGoalAttempts:numeric.nonnegative(),fieldGoalsMade:numeric.nonnegative(),threePointAttempts:numeric.nonnegative(),threePointMade:numeric.nonnegative(),freeThrowAttempts:numeric.nonnegative(),freeThrowsMade:numeric.nonnegative(),turnovers:numeric.nonnegative(),assists:numeric.optional(),rebounds:numeric.optional(),updatedAt:z.string().min(1)});
export const playerStatsSchema=z.object({playerId:z.string().min(1),season:z.string().min(1),seasonType,gamesPlayed:numeric.nonnegative(),pointsPerGame:numeric,reboundsPerGame:numeric,assistsPerGame:numeric,stealsPerGame:numeric,blocksPerGame:numeric,fieldGoalPercentage:numeric,threePointPercentage:numeric,freeThrowPercentage:numeric,trueShootingPercentage:numeric.optional(),updatedAt:z.string().min(1)});
export const playtypeSchema=z.object({playerId:z.string().min(1),playType:z.enum(['Isolation','Transition','PRBallHandler','PRRollman','Postup','Spotup','Handoff','Cut','OffScreen','OffRebound','Misc']),grouping:z.enum(['offensive','defensive']),possessions:numeric.nonnegative(),pointsPerPossession:numeric.nullable(),percentile:numeric.nullable(),season:z.string().min(1),seasonType,updatedAt:z.string().min(1)});
export const teamStatsSchema=z.object({teamId:z.string().min(1),season:z.string().min(1),seasonType,wins:numeric.optional(),losses:numeric.optional(),offensiveRating:numeric.optional(),defensiveRating:numeric.optional(),pace:numeric.optional(),updatedAt:z.string().min(1)});
