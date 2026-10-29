'use strict';
const cleanStyleBeforeInline=cleanTextStyle;
function cssHex(value){const rgb=value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);if(rgb){if(rgb[4]!==undefined&&+rgb[4]===0)return'';return'#'+rgb.slice(1,4).map(n=>(+n).toString(16).padStart(2,'0')).join('');}return/^#[0-9a-f]{6}$/i.test(value)?value:'';}
richSVGText=function(p,root){let y=9,backgrounds='',result='<text class="rich-text" xml:space="preserve" style="font-weight:'+(root?600:400)+'">';for(const line of p.richLines){let offset=root?(p.w-line.width)/2:14;const baseline=y+Math.max(...line.segments.map(s=>s.style.Size),p.fontSize);for(const part of line.segments){const s=part.style;if(s.Highlight)backgrounds+='<rect x="'+offset+'" y="'+(baseline-s.Size)+'" width="'+part.width+'" height="'+Math.ceil(s.Size*1.3)+'" rx="2" fill="'+s.Highlight+'"/>';result+='<tspan x="'+offset+'" y="'+baseline+'" style="font-family:&quot;'+esc(s.Family)+'&quot;;font-size:'+s.Size+'px;fill:'+s.Color+';font-weight:'+(s.Bold?700:root?600:400)+';font-style:'+(s.Italic?'italic':'normal')+';text-decoration:'+([s.Underline?'underline':'',s.Strike?'line-through':''].filter(Boolean).join(' ')||'none')+'">'+esc(part.text)+'</tspan>';offset+=part.width;}y+=line.height;}return'<g class="rich-highlights">'+backgrounds+'</g>'+result+'</text>';};
cleanTextStyle=function(style){const out=cleanStyleBeforeInline(style);if(style&&typeof style==='object'){for(const key of ['Bold','Italic','Underline','Strike'])if(typeof style[key]==='boolean')out[key]=style[key];if(/^#[0-9a-f]{6}$/i.test(style.Highlight||''))out.Highlight=style.Highlight;if(style.Highlight==='')out.Highlight='';}return out;};
function currentRunStyle(){if(!editor)return{};let offset=0;const start=richSelection?.start||0;const run=editorRuns().find(r=>{offset+=r.Text.length;return offset>start;});return styleForRun(editorOwner(),run||{Style:{}},editor.id==='root');}
function updateInlineToolbar(){const active=!!editor;document.body.classList.toggle('rich-editing',active);$('inline-toolbar').hidden=!active;if(!active)return;const s=currentRunStyle(),hasSelection=!!richSelection&&richSelection.ownerId===editor.id&&richSelection.end>richSelection.start;for(const [id,value]of [['inline-family',s.Family||'Microsoft YaHei UI'],['inline-size',s.Size||13],['inline-color',s.Color||'#50505a'],['inline-highlight',s.Highlight||'#fff176']])if(document.activeElement!==$(id))$(id).value=value;for(const id of ['inline-family','inline-size','inline-color','inline-highlight','inline-bold','inline-italic','inline-underline','inline-strike','inline-reset'])$(id).disabled=!hasSelection;for(const [id,key]of [['inline-bold','Bold'],['inline-italic','Italic'],['inline-underline','Underline'],['inline-strike','Strike']])$(id).classList.toggle('active',!!s[key]);$('inline-status').textContent=hasSelection?'已选 '+(richSelection.end-richSelection.start)+' 字':'拖选文字后修改格式';}
$('inline-family').innerHTML=FONT_FAMILIES.map((f,i)=>'<option value="'+f+'">'+FONT_LABELS[i]+'</option>').join('');
$('inline-family').onchange=()=>applyTextStyle({Family:$('inline-family').value});
$('inline-size').onchange=()=>applyTextStyle({Size:Number($('inline-size').value)});
$('inline-color').onchange=()=>applyTextStyle({Color:$('inline-color').value});
$('inline-highlight').onchange=()=>applyTextStyle({Highlight:$('inline-highlight').value});
for(const [id,key]of [['inline-bold','Bold'],['inline-italic','Italic'],['inline-underline','Underline'],['inline-strike','Strike']])bind(id,()=>applyTextStyle({[key]:!currentRunStyle()[key]}));
bind('inline-reset',()=>applyTextStyle({},false,true));bind('inline-image',chooseImages);bind('inline-done',()=>finishEdit());
$('inline-toolbar').addEventListener('pointerdown',e=>{rememberTextSelection();if(e.target.closest('button'))e.preventDefault();});
const rememberBeforeInline=rememberTextSelection;
rememberTextSelection=function(){rememberBeforeInline();updateInlineToolbar();};
const applyBeforeInline=applyTextStyle;
applyTextStyle=function(style,all=false,reset=false){applyBeforeInline(style,all,reset);updateInlineToolbar();};
const finishBeforeInline=finishEdit;
finishEdit=function(cancel=false){finishBeforeInline(cancel);updateInlineToolbar();};
function nextCodePointEnd(text,index){if(index>=text.length)return text.length;const code=text.codePointAt(index);return index+(code>0xffff?2:1);}
function pointAfterCharacter(container,x,y,source){
    let best=null;function consider(rect,start,end){if(rect.width<=0||rect.height<=0)return;const dx=x<rect.left?rect.left-x:x>rect.right?x-rect.right:0,dy=y<rect.top?rect.top-y:y>rect.bottom?y-rect.bottom:0;const distance=dx*dx+dy*dy*4;if(!best||distance<best.distance)best={distance,offset:end};}
    if(container instanceof SVGElement){let cursor=0;for(const span of container.querySelectorAll('tspan')){const text=span.textContent;let base=source.indexOf(text,cursor);if(base<0)base=cursor;const matrix=span.getScreenCTM();if(!matrix)continue;const count=span.getNumberOfChars();const points=Array.from(text);let utf=0;for(let i=0;i<count;i++){let start=count===points.length?utf:i;const end=nextCodePointEnd(text,start);try{const box=span.getExtentOfChar(i);const a=new DOMPoint(box.x,box.y).matrixTransform(matrix),b=new DOMPoint(box.x+box.width,box.y+box.height).matrixTransform(matrix);consider({left:Math.min(a.x,b.x),top:Math.min(a.y,b.y),right:Math.max(a.x,b.x),bottom:Math.max(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)},base+start,base+end);}catch{}utf=end;}cursor=base+text.length;}}
    else{const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);let textNode,base=0;while((textNode=walker.nextNode())){for(let i=0;i<textNode.nodeValue.length;){const end=nextCodePointEnd(textNode.nodeValue,i),range=document.createRange();range.setStart(textNode,i);range.setEnd(textNode,end);consider(range.getBoundingClientRect(),base+i,base+end);i=end;}base+=textNode.nodeValue.length;}}
    return Math.min(source.length,best?.offset??source.length);
}
const startBeforeInline=startEdit;
startEdit=function(id,point){let offset;if(point){const owner=id==='root'?doc():find(id)?.n,source=ownerPlain(owner,id==='root');const target=point.target.closest('.rich-text,.rich-label,h1,.rich-editor');if(target)offset=pointAfterCharacter(target,point.clientX,point.clientY,source);}startBeforeInline(id);if(!editor)return;if(offset!==undefined)selectEditorRange(offset,offset);updateInlineToolbar();};
document.addEventListener('dblclick',e=>{if(filter==='trash'||e.target.closest('[data-image-owner]'))return;const target=e.target.closest('.rich-text,.rich-label,h1[data-id],.rich-editor');if(!target)return;const id=target.classList.contains('rich-editor')?editor?.id:target.closest('[data-id]')?.dataset.id;if(!id)return;e.preventDefault();e.stopImmediatePropagation();if(editor&&target===editor.e){const offset=pointAfterCharacter(editor.e,e.clientX,e.clientY,richEditorValue());selectEditorRange(offset,offset);updateInlineToolbar();}else startEdit(id,e);},true);
bind('font-button',()=>{if(!editor&&selectedId)startEdit(selectedId);updateInlineToolbar();});

// Keep color picking inside the app so native picker focus cannot close the editor.
let pendingTextColor=null;
function closeTextColor(){pendingTextColor=null;$('text-color-popup').hidden=true;}
function openTextColor(key){rememberTextSelection();if(!editor||!richSelection||richSelection.end<=richSelection.start)return;pendingTextColor={state:editor,selection:{...richSelection},key};const colors=key==='Highlight'?['#fff176','#ffe0b2','#f8bbd0','#e1bee7','#c5cae9','#bbdefb','#b2dfdb','#c8e6c9']:['#303139','#68707d','#b94646','#b57828','#408366','#326eaa','#7863b6','#aa587b'];$('color-heading').textContent=key==='Highlight'?'文字高亮':'文字颜色';$('color-swatches').innerHTML=colors.map(c=>'<button type="button" class="text-swatch" data-color="'+c+'" aria-label="'+c+'" style="background:'+c+'"></button>').join('');$('color-clear').hidden=key!=='Highlight';$('color-hex').value=currentRunStyle()[key]||colors[0];$('color-error').textContent='';$('text-color-popup').hidden=false;const r=$(key==='Highlight'?'inline-highlight':'inline-color').getBoundingClientRect();$('text-color-popup').style.left=Math.max(12,Math.min(innerWidth-270,r.left-100))+'px';$('text-color-popup').style.bottom=Math.max(12,innerHeight-r.top+16)+'px';}
function applyPickedColor(value){const p=pendingTextColor;if(!p||editor!==p.state||currentId!==p.selection.documentId){closeTextColor();return;}if(value!==''&&!/^#[0-9a-f]{6}$/i.test(value)){$('color-error').textContent='请输入 # 加六位颜色值，例如 #7863B6';return;}richSelection={...p.selection};selectEditorRange(richSelection.start,richSelection.end);applyTextStyle({[p.key]:value});closeTextColor();}
bind('inline-color',()=>openTextColor('Color'));bind('inline-highlight',()=>openTextColor('Highlight'));
$('text-color-popup').addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();e.stopPropagation();});
$('color-swatches').onclick=e=>{const b=e.target.closest('[data-color]');if(b)applyPickedColor(b.dataset.color);};bind('color-apply',()=>applyPickedColor($('color-hex').value.trim()));bind('color-clear',()=>applyPickedColor(''));bind('color-close',()=>{const p=pendingTextColor;closeTextColor();if(p&&editor===p.state){editor.e.focus();selectEditorRange(p.selection.start,p.selection.end);}});
$('color-hex').onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();applyPickedColor(e.target.value.trim());}if(e.key==='Escape')$('color-close').click();};
const finishBeforeColors=finishEdit;finishEdit=function(cancel=false){closeTextColor();finishBeforeColors(cancel);};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#text-color-popup,#inline-color,#inline-highlight'))closeTextColor();if(!e.target.closest('#theme-popup,#interface-theme,#palette'))$('theme-popup').hidden=true;},true);
const UI_THEMES=[
{id:'lavender',name:'雾紫',accent:'#7863b6',side:'#f6f4fa',soft:'#eee7f7',root:'#52436b',branch:'#b8a9cd'},
{id:'sage',name:'松绿',accent:'#427a68',side:'#f1f6f2',soft:'#e3eee6',root:'#35594c',branch:'#a7bdb0'},
{id:'sky',name:'晴空蓝',accent:'#456f9e',side:'#f1f5fa',soft:'#e4edf8',root:'#344f70',branch:'#a8bdd3'},
{id:'sand',name:'暖砂',accent:'#976b3f',side:'#f8f4ed',soft:'#f1e7d7',root:'#6b513a',branch:'#cdbba2'},
{id:'rose',name:'玫瑰灰',accent:'#9b6576',side:'#f8f2f4',soft:'#f2e5eb',root:'#6b4858',branch:'#ccb0bd'}];
applyTheme=function(){const t=UI_THEMES.find(t=>t.id===library.Settings?.InterfaceTheme)||UI_THEMES[0];for(const key of ['accent','side','soft','root','branch'])document.documentElement.style.setProperty('--'+key,t[key]);document.documentElement.dataset.interfaceTheme=t.id;$('interface-theme').textContent='◐ '+t.name;$('theme-choices').innerHTML=UI_THEMES.map(x=>'<button data-theme="'+x.id+'" aria-pressed="'+(t.id===x.id)+'"><span class="theme-preview" style="background:'+x.side+';border-color:'+x.branch+'"><i style="background:'+x.soft+'"></i><i style="background:'+x.accent+'"></i><i style="background:'+x.root+'"></i></span><span>'+x.name+'</span><span class="theme-check">'+(t.id===x.id?'✓':'')+'</span></button>').join('');};
function chooseUITheme(id){if(!UI_THEMES.some(t=>t.id===id))return;library.Settings={...library.Settings,InterfaceTheme:id};applyTheme();markDirty();}
function openUIThemes(){finishEdit();$('palette-menu').hidden=true;$('theme-popup').hidden=!$('theme-popup').hidden;applyTheme();}
bind('interface-theme',openUIThemes);bind('palette',openUIThemes);bind('theme-close',()=>{$('theme-popup').hidden=true;});$('theme-choices').onclick=e=>{const b=e.target.closest('[data-theme]');if(b)chooseUITheme(b.dataset.theme);};
const undoBeforeThemes=undo;undo=function(redo=false){const settings=library.Settings;undoBeforeThemes(redo);if(settings)library.Settings=settings;applyTheme();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(pendingTextColor){e.stopImmediatePropagation();$('color-close').click();}$('theme-popup').hidden=true;}},true);

// Keep the window header short; the document breadcrumb retains the full note title.
const renderBeforeTypography=render;
render=function(){renderBeforeTypography();document.title='枝记';$('tab-title').textContent=filter==='trash'?'回收站':'笔记';};

let nativeWindowPending=true;
const renderBeforeWindow=render;
render=function(){renderBeforeWindow();if(nativeWindowPending)document.title='枝记';};
async function windowAction(action){const r=await fetch('/api/window/'+action,{method:'POST',headers:{'X-Zhiji-Token':'__SESSION_TOKEN__'}});if(!r.ok)throw Error('窗口操作失败');return r.json();}
async function attachNativeWindow(){document.title='枝记';try{for(let n=0;n<30;n++){const state=await windowAction('attach');if(state.attached){$('window-controls').hidden=false;document.body.classList.add('custom-window');break;}if(state.serverOnly)break;await new Promise(resolve=>setTimeout(resolve,150));}}catch{}finally{nativeWindowPending=false;document.title='枝记';}}
bind('window-minimize',()=>windowAction('minimize').catch(e=>toast(e.message)));
bind('window-maximize',()=>windowAction('maximize').catch(e=>toast(e.message)));
bind('window-close',async()=>{finishEdit();await save();if(savedVersion!==changedVersion){toast('笔记尚未保存，请稍后再关闭');return;}windowAction('close').catch(e=>toast(e.message));});
document.addEventListener('mousedown',e=>{if(e.button!==0||!document.body.classList.contains('custom-window')||!e.target.closest('.top,.brand')||e.target.closest('button,input,select,.tab'))return;e.preventDefault();const action=e.detail===2?'maximize':'drag';if(window.chrome?.webview)window.chrome.webview.postMessage(action);else windowAction(action).catch(()=>{});});
setTimeout(attachNativeWindow,100);

bind('open-notes-folder',()=>fetch('/api/open-notes',{method:'POST',headers:{'X-Zhiji-Token':'__SESSION_TOKEN__'}}).then(r=>{if(!r.ok)throw Error('无法打开笔记文件夹');}).catch(e=>toast(e.message)));

bind('create-desktop-shortcut',async()=>{try{const r=await fetch('/api/desktop-shortcut',{method:'POST',headers:{'X-Zhiji-Token':'__SESSION_TOKEN__'}});const result=await r.json();if(!r.ok)throw Error(result.error||'创建快捷方式失败');toast('已创建桌面快捷方式');$('more-menu').hidden=true;}catch(e){toast(e.message);}});
