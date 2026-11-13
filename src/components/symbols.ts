import type { Reward, RewardState, SymbolName } from './types';
// Code-drawn shapes are limited to supporting UI and live ink marks.
const paths: Record<'box'|'cross', string> = {
 box: '<rect x="9" y="9" width="46" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="5"/><path d="M25 10v44M40 10v44M10 25h44M10 40h44" fill="none" stroke="currentColor" stroke-width="3"/>',
 cross: '<path d="m15 13 35 38M50 13 15 50" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>'
};
export const names: Record<SymbolName, string> = {bolt:'Lightning', 'double-bolt':'Double lightning', moon:'Moon', star:'Star', wild:'Any number', box:'Lucky Box', cross:'Marked'};
export function symbol(name: SymbolName, decorative = true) {
 const semantics=decorative?'aria-hidden="true"':`role="img" aria-label="${names[name]}"`;
 if(name==='double-bolt')return `<span class="symbol symbol-double-bolt generated-symbol" ${semantics}><img src="/assets/generated/bolt.webp" alt="" draggable="false"><img src="/assets/generated/bolt.webp" alt="" draggable="false"></span>`;
 if(name==='bolt'||name==='moon'||name==='star')return `<img class="symbol symbol-${name} generated-symbol" src="/assets/generated/${name}.webp" ${decorative?'alt="" aria-hidden="true"':`alt="${names[name]}"`} draggable="false">`;
 if(name==='wild')return `<span class="symbol symbol-wild printed-wild" ${semantics}>?</span>`;
 return `<svg class="symbol symbol-${name}" viewBox="0 0 64 64" ${semantics}>${paths[name]}</svg>`;
}
export function rewardLabel(r: Reward) { return r===null?'No bonus':typeof r === 'number' ? `Number ${r}` : names[r]; }
export function reward(r: Reward, state: RewardState = 'unearned') { if(r===null)return '<span class="reward reward-empty" aria-hidden="true"></span>'; return `<span class="reward ${typeof r === 'number' ? 'reward-number' : `reward-${r}`} reward-${state}" title="${rewardLabel(r)}${state==='unearned'?'':`, ${state}`}">${typeof r === 'number' ? r : symbol(r)}</span>`; }
