'use strict';
// Creation belongs to the black + button, rather than two permanent sidebar buttons.
function closeCreateMenu(){ $('create-menu').hidden=true;$('new-doc').setAttribute('aria-expanded','false'); }
bind('new-doc',e=>{e.stopPropagation();finishEdit();const menu=$('create-menu');const opening=menu.hidden;menu.hidden=!opening;$('new-doc').setAttribute('aria-expanded',String(opening));if(opening){const rect=$('new-doc').getBoundingClientRect();menu.style.left=Math.max(12,rect.right-205)+'px';menu.style.top=(rect.bottom+9)+'px';$('create-location').textContent='添加到 '+(folderPath(validFolder(activeFolderId))||'我的文档');}});
bind('add-folder',()=>{closeCreateMenu();askFolder();});bind('add-document',()=>{closeCreateMenu();newDoc();});
document.addEventListener('click',e=>{if(!e.target.closest('#create-menu,#new-doc'))closeCreateMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCreateMenu();});

function deletedEntries(){return [...folders().filter(f=>f.Deleted).map(f=>({kind:'folder',record:f})),...library.Documents.filter(d=>d.Deleted).map(d=>({kind:'doc',record:d}))];}
function trashTime(value){return value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'历史删除记录';}
function renderTrash(){
    const all=deletedEntries(),query=$('trash-search').value.trim().toLowerCase();
    const rows=all.filter(({record:r})=>(r.Name||r.Title).toLowerCase().includes(query)).sort((a,b)=>(b.record.DeletedAt||0)-(a.record.DeletedAt||0));
    $('trash-total').textContent=all.length;
    $('trash-summary').textContent=all.filter(e=>e.kind==='folder').length+' 个文件夹 · '+all.filter(e=>e.kind==='doc').length+' 篇文档';
    $('trash-list').innerHTML=rows.length?'<div class="trash-table-head"><span>名称 / 原位置</span><span>删除时间</span><span>操作</span></div>'+rows.map(({kind,record:r})=>{
        const group=all.filter(e=>r.TrashBatch&&e.record.TrashBatch===r.TrashBatch).length;
        const location=folderPath(kind==='folder'?r.ParentId:r.FolderId)||'我的文档';
        return '<div class="trash-entry"><div class="trash-entry-info"><div class="trash-entry-icon">'+icon(kind==='folder'?'folder':'file')+'</div><div><strong>'+esc(r.Name||r.Title)+'</strong><p>'+esc(location)+(group>1?' <span class="trash-group">同组 '+group+' 项</span>':'')+'</p></div></div><time>'+esc(trashTime(r.DeletedAt))+'</time><button data-restore-kind="'+kind+'" data-restore-id="'+esc(r.Id)+'">'+(group>1?'恢复整组':'恢复')+'</button></div>';
    }).join(''):'<div class="trash-empty">'+icon('trash')+'<h3>'+(query?'没有找到相关项目':'回收站是空的')+'</h3><p>'+(query?'试试其他名称。':'删除的文件夹和文档会显示在这里，可随时恢复。')+'</p></div>';
    $('trash-list').querySelectorAll('[data-restore-id]').forEach(e=>e.onclick=()=>restoreEntry(e.dataset.restoreKind,e.dataset.restoreId));
}
const renderBeforeTrash=render;
render=function(){renderBeforeTrash();const trash=filter==='trash';document.body.classList.toggle('viewing-trash',trash);$('trash-page').hidden=!trash;$('trash').classList.toggle('active',trash);$('trash').setAttribute('aria-pressed',String(trash));if(trash){$('tab-title').textContent='回收站';document.title='回收站 · 枝记';renderTrash();}};
function openTrash(){closeCreateMenu();finishEdit();filter='trash';$('search').value='';render();}
function leaveTrash(nextFilter='all'){filter=nextFilter;activeFolderId=null;render();fitMap();}
bind('trash',openTrash);bind('leave-trash',()=>leaveTrash());$('trash-search').oninput=renderTrash;
document.querySelectorAll('[data-filter]').forEach(e=>e.onclick=()=>leaveTrash(e.dataset.filter));
const restoreBeforeTrash=restoreEntry;
restoreEntry=function(kind,id){const stay=filter==='trash';restoreBeforeTrash(kind,id);if(stay){filter='trash';activeFolderId=null;render();toast('已恢复到我的文档');}};
const libraryChangeBeforeTrash=libraryChange;
libraryChange=function(fn){const old=new Set(deletedEntries().map(e=>e.kind+':'+e.record.Id));libraryChangeBeforeTrash(fn);let added=false;for(const e of deletedEntries())if(!old.has(e.kind+':'+e.record.Id)){e.record.DeletedAt=Date.now();added=true;}if(added){markDirty();if(filter==='trash')renderTrash();}};
document.addEventListener('keydown',e=>{if(filter!=='trash'||e.target.matches('input,textarea,select')||(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)))return;if(['Enter','Tab','F2','Delete','Backspace'].includes(e.key)||e.key.startsWith('Arrow')||(e.ctrlKey&&['[',']'].includes(e.key))){if(e.key==='Tab')return;e.preventDefault();e.stopImmediatePropagation();}},true);
for(const type of ['paste','drop'])document.addEventListener(type,e=>{if(filter==='trash'){e.preventDefault();e.stopImmediatePropagation();}},true);

// Edit only the text region. The former full-node textarea covered attached images.
startEdit=function(id){
    if(filter==='trash')return;
    finishEdit();selectedId=id;
    const n=id==='root'?{Text:doc()?.Title}:find(id)?.n;if(!n)return;
    const canvas=$('canvas').getBoundingClientRect();
    let rect,anchor;
    if(view==='map'){
        const p=positions.get(id);if(!p)return;
        const textHeight=p.textH||p.h;
        rect={left:canvas.left+transform.x+(p.x+7)*transform.k,top:canvas.top+transform.y+(p.y+3)*transform.k,width:Math.max(40,(p.w-14)*transform.k),height:Math.max(20,(textHeight-6)*transform.k)};
    }else{
        const row=$('outline').querySelector('[data-id="'+id+'"]');if(!row)return;
        anchor=id==='root'?row:row.querySelector('.text');
        if(id!=='root'){
            const label=document.createElement('div');label.className='editing-label';
            while(anchor.firstChild&&anchor.firstChild.nodeType===Node.TEXT_NODE)label.append(anchor.firstChild);
            anchor.prepend(label);anchor=label;
        }
        rect=anchor.getBoundingClientRect();
    }
    const e=document.createElement('textarea');e.className='editor text-only-editor';e.value=n.Text;
    if(view==='map'){
        e.style.left=(rect.left-canvas.left)+'px';e.style.top=(rect.top-canvas.top)+'px';e.style.width=rect.width+'px';e.style.height=rect.height+'px';
        e.style.minWidth='0';e.style.minHeight='0';e.style.padding=(4*transform.k)+'px '+(5*transform.k)+'px';e.style.fontSize=(13*transform.k)+'px';e.style.lineHeight=(21*transform.k)+'px';
        $('canvas').append(e);
    }else{
        e.classList.add('outline-text-editor');e.style.width='100%';e.style.height=Math.max(34,rect.height+8)+'px';
        anchor.hidden=true;anchor.after(e);
    }
    editor={e,id,original:n.Text,anchor,inline:view==='outline'};
    if(anchor&&id!=='root')editor.label=anchor;
    e.oninput=()=>{
        if(view==='outline'){
            e.style.height='auto';e.style.height=Math.max(34,e.scrollHeight+2)+'px';
        }else{
            const p=positions.get(id);if(!p)return;
            const m=metrics({...p.n,Text:e.value||' '},p.depth);
            const delta=(m.textH||m.h)-(p.textH||p.h);
            const group=$('scene').querySelector('.node[data-id="'+id+'"]');
            const attachment=group?.querySelector('.map-attachment');
            if(attachment)attachment.setAttribute('transform','translate(0,'+Math.max(0,delta)+')');
            const body=group?.querySelector('.body');if(body)body.setAttribute('height',p.h+Math.max(0,delta));
            const text=group?.querySelector('text');if(text)text.style.visibility='hidden';
            e.style.height=Math.max(rect.height,((m.textH||m.h)-6)*transform.k)+'px';
        }
    };
    e.onkeydown=ev=>{if(ev.isComposing)return;if(ev.key==='Escape'){ev.preventDefault();finishEdit(true);}else if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();finishEdit();}else if(ev.key==='Tab'){ev.preventDefault();finishEdit();addNode(true);}};
    e.onblur=()=>finishEdit();e.focus();e.select();
};
finishEdit=function(cancel=false){
    if(!editor)return;const {e,id,original,anchor,label}=editor;editor=null;
    const value=e.value.trim();e.onblur=null;e.remove();if(anchor)anchor.hidden=false;
    if(label){while(label.firstChild)label.before(label.firstChild);label.remove();}
    if(!cancel&&value&&value!==original&&doc()){
        checkpoint();if(id==='root')doc().Title=value;else{const f=find(id);if(f)f.n.Text=value;}
        doc().Updated=Date.now();markDirty();render();
    }else if(view==='map')renderMap();
};
