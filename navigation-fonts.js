'use strict';
// Browsing history is independent of the content undo/redo history.
let navigationPast=[],navigationFuture=[],navigationCurrent=null,navigationPending=false,navigationRestoring=false;
function navigationState(){return{currentId,filter,view,activeFolderId,selectedId,query:$('search').value,trashQuery:$('trash-search').value,transform:{...transform},outlineScroll:$('outline').scrollTop||0,trashScroll:$('trash-page').scrollTop||0};}
function routeKey(s){return JSON.stringify([s.currentId,s.filter,s.view,s.activeFolderId]);}
function updateNavigationButtons(){const transient=!!editor||!!$('modal-root').innerHTML||!$('font-panel').hidden||!$('create-menu').hidden;$('nav-back').disabled=!navigationPast.length&&!transient;$('nav-forward').disabled=!navigationFuture.length;}
function flushNavigation(){
    navigationPending=false;if(!ready||navigationRestoring)return;
    const next=navigationState();
    if(navigationCurrent&&routeKey(next)!==routeKey(navigationCurrent)){navigationPast.push(navigationCurrent);if(navigationPast.length>100)navigationPast.shift();navigationFuture=[];}
    navigationCurrent=next;updateNavigationButtons();
}
function scheduleNavigation(){if(navigationRestoring||navigationPending)return;navigationPending=true;queueMicrotask(flushNavigation);}
function rememberViewport(){if(navigationCurrent&&routeKey(navigationCurrent)===routeKey(navigationState()))navigationCurrent=navigationState();}
function navigateHistory(forward=false){
    // Returning from an editor or dialog first closes it without discarding text.
    if(editor){finishEdit();updateNavigationButtons();return;}
    if($('modal-root').innerHTML){$('modal-root').innerHTML='';updateNavigationButtons();return;}
    if(!$('font-panel').hidden){$('font-panel').hidden=true;updateNavigationButtons();return;}
    if(!$('create-menu').hidden){closeCreateMenu();updateNavigationButtons();return;}
    flushNavigation();const source=forward?navigationFuture:navigationPast,target=forward?navigationPast:navigationFuture;
    if(!source.length)return;target.push(navigationState());const s=source.pop();navigationRestoring=true;
    currentId=library.Documents.some(d=>d.Id===s.currentId&&!d.Deleted)?s.currentId:library.Documents.find(d=>!d.Deleted)?.Id||null;
    filter=s.filter;view=s.view;activeFolderId=validFolder(s.activeFolderId);selectedId=s.selectedId;
    if(selectedId!=='root'&&!find(selectedId))selectedId=null;
    $('search').value=s.query||'';$('trash-search').value=s.trashQuery||'';
    render();transform={...s.transform};if(view==='map')applyTransform();$('outline').scrollTop=s.outlineScroll;$('trash-page').scrollTop=s.trashScroll;
    navigationCurrent=navigationState();navigationRestoring=false;updateNavigationButtons();
}
const renderBeforeNavigation=render;
render=function(){renderBeforeNavigation();scheduleNavigation();};
const filesBeforeNavigation=renderFiles;
renderFiles=function(){filesBeforeNavigation();scheduleNavigation();};
for(const event of ['pointerdown','keydown'])document.addEventListener(event,rememberViewport,true);
bind('nav-back',()=>navigateHistory());bind('nav-forward',()=>navigateHistory(true));
// Toolbar back/forward also close transient surfaces when no route is available.
function enableTransientBack(){updateNavigationButtons();}
document.addEventListener('click',()=>queueMicrotask(enableTransientBack));
document.addEventListener('keydown',e=>{if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();e.stopImmediatePropagation();navigateHistory(e.key==='ArrowRight');}},true);

const FONT_FAMILIES=['Microsoft YaHei UI','Microsoft YaHei','SimSun','SimHei','KaiTi','FangSong','Arial','Times New Roman','Consolas'];
const FONT_LABELS=['默认 · 微软雅黑 UI','微软雅黑','宋体','黑体','楷体','仿宋','Arial','Times New Roman','Consolas'];
function cleanTextStyle(style){const result={};if(style&&typeof style==='object'){if(FONT_FAMILIES.includes(style.Family))result.Family=style.Family;if(Number.isFinite(+style.Size))result.Size=Math.min(48,Math.max(10,Math.round(+style.Size)));if(/^#[0-9a-f]{6}$/i.test(style.Color||''))result.Color=style.Color;}return result;}
function textStyle(owner,root=false){const s=cleanTextStyle(owner?.TextStyle);return{Family:s.Family||'Microsoft YaHei',Size:s.Size||(root?20:16),Color:s.Color||(root?'#ffffff':'#50505a')};}
const normalizeItemBeforeText=normalizeItem;
normalizeItem=function(n){normalizeItemBeforeText(n);n.TextStyle=cleanTextStyle(n.TextStyle);return n;};
const normalizeDocBeforeText=normalizeDoc;
normalizeDoc=function(d){normalizeDocBeforeText(d);d.TextStyle=cleanTextStyle(d.TextStyle);return d;};
function selectedTextOwner(){return selectedId==='root'?doc():find(selectedId)?.n;}
function applyTextStyle(style,all=false){if(!doc()||filter==='trash')return;const clean=cleanTextStyle(style);mutate(()=>{if(all){doc().TextStyle={...clean};walk(doc().Items,n=>n.TextStyle={...clean});}else{const owner=selectedTextOwner();if(owner)owner.TextStyle={...clean};}},true);syncFontControls();}
function syncFontControls(){const owner=selectedTextOwner(),s=textStyle(owner,selectedId==='root');$('font-family').value=s.Family;$('font-size').value=s.Size;$('font-color').value=s.Color;$('font-preview').style.fontFamily='"'+s.Family+'",sans-serif';$('font-preview').style.fontSize=s.Size+'px';$('font-preview').style.color=s.Color;$('font-preview').style.background=s.Color.toLowerCase()==='#ffffff'?'#39323f':'#faf8fd';$('font-target').textContent=selectedId==='root'?'文档中心主题':find(selectedId)?.n.Text||'请选择主题';}
function openFontPanel(){if(filter==='trash'||!doc())return;finishEdit();if(!selectedId)selectedId='root';syncFontControls();$('font-panel').hidden=!$('font-panel').hidden;enableTransientBack();}
$('font-family').innerHTML=FONT_FAMILIES.map((f,i)=>'<option value="'+f+'">'+FONT_LABELS[i]+'</option>').join('');
bind('font-button',openFontPanel);bind('font-close',()=>{$('font-panel').hidden=true;updateNavigationButtons();});
bind('font-apply',()=>applyTextStyle({Family:$('font-family').value,Size:Number($('font-size').value),Color:$('font-color').value},$('font-all').checked));
bind('font-reset',()=>applyTextStyle({},$('font-all').checked));
for(const id of ['font-family','font-size','font-color'])$(id).oninput=()=>{const size=Math.min(48,Math.max(10,Number($('font-size').value)||13));$('font-preview').style.fontFamily='"'+$('font-family').value+'",sans-serif';$('font-preview').style.fontSize=size+'px';$('font-preview').style.color=$('font-color').value;$('font-preview').style.background=$('font-color').value==='#ffffff'?'#39323f':'#faf8fd';};
document.addEventListener('click',e=>{if(!e.target.closest('#font-panel,#font-button,#selection-tools,.rich-editor,#inline-toolbar')&&!$('font-panel').hidden){$('font-panel').hidden=true;updateNavigationButtons();}});

// Measure SVG text with its actual typeface and size, including attached pictures.
metrics=function(n,depth){const s=textStyle(n,depth===0),lineHeight=Math.round(s.Size*1.55),font=(depth===0?'600 ':'')+s.Size+'px "'+s.Family+'"';const lines=wrap(n.Text,depth===0?220:300,font);measure.font=font;const textH=Math.max(depth===0?48:36,lines.length*lineHeight+18);const images=imagesOf(n);const imageH=images.length?Math.max(70,Math.min(150,190*images[0].Height/images[0].Width)):0;return{lines,w:Math.max(depth===0?90:70,...lines.map(l=>measure.measureText(l).width+32+(n.Note?12:0)),images.length?218:0),h:textH+(images.length?imageH+16:0),textH,imageH,lineHeight,fontSize:s.Size,fontFamily:s.Family,textColor:s.Color};};
const mapBeforeText=renderMap;
renderMap=function(){mapBeforeText();if(!$('font-panel').hidden)syncFontControls();};
const outlineBeforeText=renderOutline;
renderOutline=function(){outlineBeforeText();const d=doc();if(!d)return;const root=$('outline').querySelector('h1[data-id="root"]');if(root){const s=cleanTextStyle(d.TextStyle);root.style.fontFamily='"'+(s.Family||'Microsoft YaHei UI')+'",sans-serif';root.style.fontSize=(s.Size||29)+'px';root.style.color=s.Color||'#303139';}for(const el of $('outline').querySelectorAll('.outline-row')){const n=find(el.dataset.id)?.n;if(!n)continue;const s=textStyle(n);const label=el.querySelector('.text');label.style.fontFamily='"'+s.Family+'",sans-serif';label.style.fontSize=s.Size+'px';label.style.lineHeight=Math.round(s.Size*1.65)+'px';label.style.color=s.Color;label.dataset.lineHeight=Math.round(s.Size*1.65);el.querySelector('.notes')?.style.setProperty('font-size','12px');}if(!$('font-panel').hidden)syncFontControls();};
const startEditBeforeText=startEdit;
startEdit=function(id){startEditBeforeText(id);if(!editor)return;const s=textStyle(id==='root'?doc():find(id)?.n,id==='root');editor.e.style.fontFamily='"'+s.Family+'",sans-serif';editor.e.style.fontSize=(s.Size*(view==='map'?transform.k:1))+'px';editor.e.style.lineHeight=(Math.round(s.Size*1.55)*(view==='map'?transform.k:1))+'px';editor.e.style.color=s.Color;editor.e.style.background=s.Color.toLowerCase()==='#ffffff'?'#39323f':'#ffffff';if(view==='outline'){if(editor.label)editor.label.style.lineHeight=Math.round(s.Size*1.65)+'px';editor.e.style.height='auto';editor.e.style.height=Math.max(34,(editor.e.scrollHeight||32)+2)+'px';}enableTransientBack();};
// Explicit content undo controls stay available alongside browsing back/forward.
bind('undo',()=>undo());bind('redo',()=>undo(true));
