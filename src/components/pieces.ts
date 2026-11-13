import { symbol, reward, rewardLabel } from './symbols';
import type { LuckyCardData, CardView, ScoreData, SymbolName, PieceState, RewardState } from './types';
export function escape(text: string) { return text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function luckyCard(data: LuckyCardData, view: CardView = {}) {
 if (view.back) return cardBack('lucky', data.id);
 const marked = view.marked ?? [];
 const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8]];
 const cardReward = (index: number) => {
  const state: RewardState = view.bonuses?.[index] ?? (lines[index].every(i=>marked.includes(i))?'applied':'unearned');
  const label = `Box ${data.serial}, ${index<3?'row':'column'} ${index%3+1} bonus: ${rewardLabel(data.rewards[index])}, ${state}${state==='pending'&&view.interactive?', apply bonus':''}`;
  const attrs = `class="reward-slot" data-card="${data.id}" data-bonus="${index}" data-bonus-state="${state}" aria-label="${label}"`;
  return state==='pending'&&view.interactive?`<button ${attrs} data-action="apply-bonus">${reward(data.rewards[index],state)}</button>`:`<span ${attrs} role="img" tabindex="-1">${reward(data.rewards[index],state)}</span>`;
 };
 return `<article class="lucky-card" style="--card-color:${data.color}" data-card-id="${data.id}" aria-label="Lucky Box ${data.serial}">
 <img class="piece-body" src="/assets/generated/${['card','lilac','sage','honey','sky','rose'][(Number(data.serial)-1)%6]??'card'}.webp" alt="" draggable="false"><div class="card-heading"><span>LUCKY BOX</span></div>
 <div class="box-grid">${data.numbers.map((n,i) => {
 const isMarked = marked.includes(i);
 const attributes = `class="number-cell ${isMarked ? 'is-marked' : ''}"`;
 const contents = `<img class="well-layer" src="/assets/generated/well.webp" alt="" draggable="false"><span class="cell-value">${n}</span>${isMarked ? `<span class="ink-cross">${symbol('cross')}</span>` : ''}`;
 return `${i % 3 === 0 && i > 0 ? cardReward(i/3-1) : ''}${view.interactive ? `<button ${attributes} data-action="mark" data-card="${data.id}" data-cell="${i}" aria-label="Box ${data.serial}, row ${Math.floor(i/3)+1}, column ${i%3+1}, number ${n}${isMarked?', marked':''}" aria-pressed="${isMarked}">${contents}</button>` : `<div ${attributes}>${contents}</div>`}`;
 }).join('')}${cardReward(2)}${[0,1,2].map((n) => cardReward(n+3)).join('')}<span class="card-serial">${data.serial}</span></div>
 <div class="card-foot">${view.canUndo?`<button class="piece-undo" data-action="undo" aria-label="Undo last action on Box ${data.serial}">Undo ↶</button>`:''}${view.interactive || view.inspectable ? `<button class="inspect-piece" data-action="inspect" data-card="${data.id}" aria-label="Enlarge Lucky Box ${data.serial}">↗</button>` : ''}</div></article>`;
}
export function cardBack(kind: 'lucky' | 'number', id: string = kind) {
 return `<div class="card-back ${kind}-back" data-piece-id="${id}" role="img" aria-label="${kind === 'lucky' ? 'Lucky Box' : 'Number card'} reverse"><img class="piece-body" src="/assets/generated/${kind==='lucky'?'back':'numberback'}.webp" alt="" draggable="false"><div class="back-logo"><span>SUPER</span><span>MEGA</span><span>LUCKY</span><span>BOX</span></div><span class="back-caption">${kind === 'lucky' ? 'GOOD THINGS COME IN BOXES' : 'WHAT’S YOUR LUCKY NUMBER?'}</span></div>`;
}
export function numberCard(value: number, options: {back?: boolean; current?: boolean; id?: string} = {}) {
 if(options.back) return cardBack('number', options.id);
 return `<div class="number-card ${options.current?'is-current':''}" data-piece-id="${options.id ?? `number-${value}`}" role="img" aria-label="Number card ${value}"><img class="piece-body" src="/assets/generated/number.webp" alt="" draggable="false"><span class="corner-number">${value}</span><div class="number-orbit" aria-hidden="true"><i></i><b>${value}</b><i></i></div><span class="corner-number corner-bottom">${value}</span><span class="number-caption">SUPER MEGA LUCKY BOX</span></div>`;
}
export function token(kind: 'bolt' | 'moon', options: {state?: PieceState; interactive?: boolean; id?: string} = {}) {
 const state = options.state ?? 'available';
 const inner = `<span class="token-art token-${kind}" aria-hidden="true">${symbol(kind)}</span>`;
 return options.interactive ? `<button class="token-piece state-${state}" data-action="token" data-token="${options.id ?? kind}" aria-label="${kind === 'bolt'?'Lightning':'Moon'} token${state==='available'?'':`, ${state}`}" aria-pressed="${state==='selected'}">${inner}</button>` : `<span class="token-piece state-${state}" role="img" aria-label="${kind==='bolt'?'Lightning':'Moon'} token">${inner}</span>`;
}
export function marker() { return `<div class="marker" role="img" aria-label="Dry erase marker with eraser cap"><img src="/assets/generated/marker.webp" alt="" draggable="false"></div>`; }
export function scorecard(data: ScoreData, back = false) {
 if(back) return `<article class="scorecard scorecard-back" style="--player-color:${data.color}" aria-label="Scorecard reverse, scoring reference"><img class="score-body" src="/assets/generated/score.webp" alt="" draggable="false"><div class="score-heading"><span>THE LUCKY LITTLE GUIDE</span>${symbol('star')}</div><h3>Make every box count.</h3><div class="guide-row">${symbol('box')}<div><b>Complete a card</b><p>Round 1 / 2 / 3 / 4<br><strong>15 / 12 / 10 / 8 points</strong></p></div></div><div class="guide-row">${symbol('star')}<div><b>Collect stars each round</b><p>1 / 2 / 3 stars = 1 / 4 / 9 points</p></div></div><div class="guide-row">${symbol('moon')}<div><b>Watch the moons</b><p>Most: +6 points. Fewest: −6.<br>No penalty with two players.</p></div></div><div class="guide-row">${symbol('cross')}<div><b>Unfinished cards</b><p>1 point per 2 marks in total.</p></div></div><p class="solo-reference">SOLO MOONS &nbsp; 0 · 1 · 2 · 3 · 4 · 5 · 6+<br>POINTS &nbsp; −6 · −2 · 0 · 1 · 3 · 6 · 10</p></article>`;
 const boxTotal = data.completed.reduce((s,n,i) => s+n*[15,12,10,8][i],0), starTotal = data.stars.reduce((s,n)=>s+n*n,0);
 return `<article class="scorecard" style="--player-color:${data.color}" data-score-id="${data.id}" aria-label="${escape(data.name)}’s scorecard"><img class="score-body" src="/assets/generated/score.webp" alt="" draggable="false"><div class="score-heading"><span>SUPER MEGA SCORECARD</span>${symbol('star')}</div><div class="score-name"><h3>${escape(data.name)}</h3><span>GOOD LUCK, YOU.</span></div><div class="score-table"><div class="score-labels"><span>ROUND</span><span>BOXES</span><span>STARS</span><span>POINTS</span></div>${[0,1,2,3].map(i=>`<div class="score-row"><b>${i+1}</b><span>${data.completed[i]} <small>× ${[15,12,10,8][i]}</small></span><span class="score-stars" role="group" aria-label="${data.stars[i]} ${data.stars[i]===1?'star':'stars'} collected this round">${[0,1,2].map(s=>`<span class="score-star-slot ${s<data.stars[i]?'circled':''}" role="img" aria-label="${s+1} ${s===0?'star':'stars'}: ${(s+1)**2} ${(s+1)**2===1?'point':'points'} total, ${s<data.stars[i]?'claimed':'unclaimed'}"><span class="score-star-art">${symbol('star')}</span><small class="score-star-value">${(s+1)**2}</small></span>`).join('')}</span><strong>${data.completed[i]*[15,12,10,8][i]+data.stars[i]**2}</strong></div>`).join('')}</div><div class="end-score"><span>Unfinished boxes <b>+${data.incomplete}</b></span><span>Moon bonus <b>${data.moons>=0?'+':''}${data.moons}</b></span></div><div class="mega-total"><span>MEGA<br>TOTAL</span><strong>${boxTotal+starTotal+data.incomplete+data.moons}</strong>${symbol('star')}</div></article>`;
}
export function bonusSpecimen(value: SymbolName | number, explanation: string) {return `<div class="bonus-specimen">${reward(value)}<h3>${rewardLabel(value)}</h3><p>${explanation}</p></div>`;}
