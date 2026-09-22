import { useMemo, useState } from 'react';
import type { AvatarSize, Player } from '../lib/types';

export const playerHeadshotUrl = (player: Player) =>
  player.headshotUrl || `https://cdn.nba.com/headshots/nba/latest/1040x760/${encodeURIComponent(player.id)}.png`;

export function PlayerAvatar({ player, size = 'medium', square = false }: { player: Player; size?: AvatarSize; square?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = useMemo(() => player.shortName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2), [player.shortName]);
  return <span className={`avatar avatar-${size}${square ? ' avatar-square' : ''}`} aria-label={`${player.name} 球员头像`}>
    <span aria-hidden="true">{initials}</span>
    {!failed && <img src={playerHeadshotUrl(player)} alt={`${player.name} 球员头像`} loading="lazy" onError={() => setFailed(true)} />}
  </span>;
}
