import { luckyCard } from './pieces';
import type { CardView, LuckyCardData } from './types';
/** Production inspector: enlarges the same instance and restores its exact control's focus. */
export class CardInspector {
 private cardId?: string;
 private trigger?: HTMLElement;
 private origin?: Element;
 constructor(private dialog: HTMLDialogElement, private card: (id:string)=>LuckyCardData, private view: (id:string)=>CardView) {
  dialog.addEventListener('close',()=>{
   this.cardId=undefined;
   if(this.trigger?.isConnected)this.trigger.focus({preventScroll:true});
   else if(this.trigger?.dataset.card) {
    const d=this.trigger.dataset;
    const control=d.cell!==undefined?`[data-cell="${d.cell}"]`:'[data-action="inspect"]';
    this.origin?.querySelector<HTMLButtonElement>(`[data-card="${d.card}"]${control}`)?.focus({preventScroll:true});
   }
   this.trigger=undefined;this.origin=undefined;
  });
  dialog.addEventListener('click',e=>{
   if(e.target!==dialog)return;
   const r=dialog.getBoundingClientRect();
   if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.close();
  });
 }
 get isOpen(){return this.dialog.open;}
 show(id:string,trigger:HTMLElement,feedback:string) {
  this.trigger=trigger;this.origin=trigger.closest('[data-piece-region]')??document.body;
  this.cardId=id;this.render(feedback);this.dialog.showModal();
  this.dialog.querySelector<HTMLButtonElement>('[data-action="close"]')!.focus();
 }
 render(feedback:string) {
  if(!this.cardId)return;
  const card=this.card(this.cardId);
  this.dialog.querySelector('#inspection-title')!.textContent=`Lucky Box ${card.serial}`;
  this.dialog.querySelector('#inspection-art')!.innerHTML=luckyCard(card,this.view(card.id));
  this.dialog.querySelector('#inspection-art [data-action="inspect"]')?.remove();
  this.dialog.querySelector('#inspection-feedback')!.innerHTML=feedback;
 }
 close(){this.dialog.close();}
}
