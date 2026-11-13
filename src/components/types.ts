export type SymbolName = 'bolt' | 'double-bolt' | 'moon' | 'star' | 'wild' | 'box' | 'cross';
export type Reward = SymbolName | number;
export type RewardState = 'unearned' | 'pending' | 'applied';
export type PieceState = 'available' | 'selected';
export interface LuckyCardData { id: string; serial: string; color: string; numbers: number[]; rewards: Reward[]; }
export interface CardView { marked?: number[]; bonuses?: RewardState[]; interactive?: boolean; back?: boolean; canUndo?: boolean; }
export interface MarkChoice { type: 'mark'; cardId: string; cell: number; }
export interface ApplyBonusChoice { type: 'apply-bonus'; cardId: string; bonus: number; }
export type CardChoice = MarkChoice | ApplyBonusChoice;
export interface ScoreData { id: string; name: string; color: string; completed: number[]; stars: number[]; incomplete: number; moons: number; }
export type AuthorityResult = { accepted: true } | { accepted: false; reason: string };
export interface MarkAuthority { readonly lastChoice: CardChoice | undefined; readonly canUndo: boolean; submit(choice: MarkChoice): AuthorityResult; applyBonus(choice: ApplyBonusChoice): AuthorityResult; bonusStates(cardId: string): RewardState[]; undo(): CardChoice | undefined; }
