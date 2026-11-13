import type { LuckyCardData, ScoreData } from '../components/types';
// Art-direction specimens, not a transcription of the publisher's 60-card deck.
export const cards: LuckyCardData[] = [
 {id:'coral-01',serial:'01',color:'#e76b4f',numbers:[1,4,7,2,5,8,3,6,9],rewards:[7,8,'wild','bolt','star','moon']},
 {id:'lilac-02',serial:'02',color:'#9982b8',numbers:[2,3,6,5,7,1,8,9,4],rewards:['moon',4,'double-bolt','star','wild',6]},
 {id:'mint-03',serial:'03',color:'#81a99a',numbers:[3,5,9,1,6,8,2,4,7],rewards:['star',2,'moon','double-bolt',9,'wild']},
 {id:'ochre-04',serial:'04',color:'#d8ac52',numbers:[4,1,8,6,9,3,7,2,5],rewards:['wild','bolt',5,'moon',3,'star']},
 {id:'blue-05',serial:'05',color:'#7499b4',numbers:[5,2,7,8,4,6,9,3,1],rewards:[1,'star','double-bolt',8,'moon','wild']},
 {id:'rose-06',serial:'06',color:'#c17c92',numbers:[6,4,1,9,2,7,5,8,3],rewards:['double-bolt','wild',3,'star',2,'moon']}
];
export const scores: ScoreData[] = ['Alex','Robin','Sam','Jamie','Jules','Morgan'].map((name,i)=>({id:`player-${i+1}`,name,color:cards[i].color,completed:[1,0,2,1],stars:[1,2,1,0],incomplete:4,moons:i===0?6:0}));
