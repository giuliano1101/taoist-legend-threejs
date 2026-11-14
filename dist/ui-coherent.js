const $=id=>document.getElementById(id);
const pause=$('pause'),help=$('help');
const copyIcon=id=>$(id).querySelector('.aaa-icon').cloneNode(true);
const mark=document.createElement('div');mark.className='ui-menu-mark';mark.setAttribute('aria-hidden','true');mark.append(document.querySelector('.aaa-seal .aaa-icon').cloneNode(true));pause.prepend(mark);
pause.setAttribute('role','dialog');pause.setAttribute('aria-modal','true');pause.setAttribute('aria-labelledby','pause-title');pause.querySelector('h2').id='pause-title';
const secondary=document.createElement('div');secondary.className='ui-menu-secondary';
for(const [id,source,text] of [['pause-help','help-button','修行手札'],['pause-reset','reset-button','回到起点']]){
 const b=document.createElement('button');b.id=id;b.type='button';b.append(copyIcon(source),document.createTextNode(text));b.onclick=()=>$(source).click();secondary.append(b);
}
$('resume-button').after(secondary);
const helpMark=document.createElement('span');helpMark.className='ui-help-mark';helpMark.setAttribute('aria-hidden','true');helpMark.append(copyIcon('help-button'));help.querySelector('h2').prepend(helpMark);
help.querySelector('h2').id='help-title';help.setAttribute('aria-labelledby','help-title');
const description=help.querySelector(':scope > p');if(description)description.innerHTML=description.innerHTML.replace('远处会嘶吼','远处会抽泣');
for(const [key,angle] of [['KeyW',0],['KeyD',90],['KeyS',180],['KeyA',270]]){
 const b=document.querySelector(`.touch-pad [data-key="${key}"]`);if(b)b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" style="transform:rotate(${angle}deg)"><path d="M5 12l7-7 7 7M12 5v15"/></svg>`;
}
let previous={pause:true,help:true};
new MutationObserver(()=>{
 if(!help.hidden&&previous.help){help.scrollTop=0;$('close-help').focus({preventScroll:true});}
 else if(help.hidden&&!previous.help)(pause.hidden?$('help-button'):$('pause-help')).focus({preventScroll:true});
 else if(!pause.hidden&&previous.pause&&help.hidden)$('resume-button').focus({preventScroll:true});
 previous={pause:pause.hidden,help:help.hidden};
}).observe($('app'),{attributes:true,subtree:true,attributeFilter:['hidden']});
window.addEventListener('keydown',event=>{
 const dialog=!help.hidden?help:!pause.hidden?pause:null;if(!dialog)return;
 if(!help.hidden&&event.target===$('fog-density')&&['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.code)){event.stopImmediatePropagation();return;}
 if(!help.hidden&&['KeyP','Enter'].includes(event.code)&&!(event.target instanceof HTMLButtonElement)){event.preventDefault();event.stopImmediatePropagation();return;}
 if(event.code!=='Tab')return;
 const controls=[...dialog.querySelectorAll('button,input')].filter(e=>!e.disabled&&e.getClientRects().length),first=controls[0],last=controls.at(-1);
 if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first?.focus();}
},{capture:true});
