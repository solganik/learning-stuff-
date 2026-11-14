// Set VITE_PLAYER_NAME in .env.local (gitignored) so her real name never lands in the repo.
export const PLAYER_NAME: string = import.meta.env.VITE_PLAYER_NAME || 'אלופה';
export const REWARD_TEXT = 'קיבלת שפתון! 💄';
/** The reward needs this many smart solves; plain correct answers still earn ⭐ but not the prize. */
export const SMART_FOR_REWARD = 6;
