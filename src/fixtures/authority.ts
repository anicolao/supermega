import type { MarkAuthority, MarkChoice, ApplyBonusChoice, CardChoice, AuthorityResult, RewardState } from '../components/types';
import { cards } from './catalog';
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8]];
/** Deterministic review adapter. Applying a bonus records resolution; actual reward effects belong to the future rules engine. */
export class FixtureAuthority implements MarkAuthority {
 marked = new Map<string, number[]>([[cards[0].id,[0,1,3,6]],[cards[1].id,[2,4]],[cards[2].id,[0,4,8]],[cards[3].id,[0,1,2,3,4,5,6,7,8]]]);
 private applied = new Map<string,number[]>([[cards[3].id,[0,1,2,3,4,5]]]);
 private history: {choice: CardChoice; marks: number[]; applied: number[]}[] = [];
 get lastChoice() { return this.history.at(-1)?.choice; }
 get canUndo() { return this.history.length > 0; }
 bonusStates(cardId: string): RewardState[] {
  const marks=this.marked.get(cardId)??[];
  return lines.map((line,i)=>!line.every(cell=>marks.includes(cell))?'unearned':this.applied.get(cardId)?.includes(i)?'applied':'pending');
 }
 private remember(choice:CardChoice) {
  this.history.push({choice:{...choice},marks:[...(this.marked.get(choice.cardId)??[])],applied:[...(this.applied.get(choice.cardId)??[])]});
 }
 undo(): CardChoice | undefined {
  const entry = this.history.pop();
  if(!entry)return;
  this.marked.set(entry.choice.cardId,entry.marks);
  this.applied.set(entry.choice.cardId,entry.applied);
  return entry.choice;
 }
 reset() {const initial=new FixtureAuthority();this.marked=initial.marked;this.applied=initial.applied;this.history=[];}
 submit(choice: MarkChoice): AuthorityResult {
  const card = cards.find(c=>c.id===choice.cardId);
  if(!card || !Number.isInteger(choice.cell) || choice.cell<0 || choice.cell>8) return {accepted:false,reason:'That square is not available.'};
  if(this.marked.get(choice.cardId)?.includes(choice.cell)) return {accepted:false,reason:'That square is already marked. Choose an open square.'};
  this.remember(choice);
  this.marked.set(choice.cardId,[...(this.marked.get(choice.cardId)??[]),choice.cell]);
  return {accepted:true};
 }
 applyBonus(choice: ApplyBonusChoice): AuthorityResult {
  if(!Number.isInteger(choice.bonus)||this.bonusStates(choice.cardId)[choice.bonus]!=='pending') return {accepted:false,reason:'That bonus is not pending.'};
  this.remember(choice);
  this.applied.set(choice.cardId,[...(this.applied.get(choice.cardId)??[]),choice.bonus]);
  return {accepted:true};
 }
}
