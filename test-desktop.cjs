const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),assert=require('assert');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const dir=path.resolve('.test-runs',Date.now().toString());fs.mkdirSync(dir,{recursive:true});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=';
const fixture={Folders:[{Id:'folder-study',Name:'学习资料',ParentId:null}],Documents:[{Id:'doc-test',Title:'图片与文件夹测试',FolderId:'folder-study',Items:[{Id:'node-test',Text:'图片随笔记保存',Note:'关闭后重新打开，图片仍然可见。',Children:[],Images:[{Id:'image-test',Src:png,Name:'测试图片.png',Width:1,Height:1}]}]}]};
let host,browser,ws;let msgId=0;const pending=new Map(),errors=[];
function startHost(){return spawn(path.resolve('dist/Zhiji-v13.exe'),['--test-server',dir],{windowsHide:true,stdio:'ignore'});}
async function info(){for(let i=0;i<100;i++){try{return JSON.parse(fs.readFileSync(path.join(dir,'server-info.json'),'utf8'));}catch{}await sleep(100);}throw Error('Server did not start');}
async function request(server,method,body,auth=true){const r=await fetch(server.origin+'/api/library',{method,headers:{...(auth?{'X-Zhiji-Token':server.token}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return r;}
async function cdp(method,params={},sessionId){const id=++msgId;const result=new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('CDP timeout: '+method));}},20000).unref();});ws.send(JSON.stringify({id,method,params,sessionId}));return result;}
async function evaluate(expression,session){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
(async()=>{try{
host=startHost();let server=await info();assert.equal((await request(server,'GET',null,false)).status,403);
assert.equal((await request(server,'POST',fixture)).status,200);assert.deepEqual(await(await request(server,'GET')).json(),fixture);
host.kill();await sleep(300);fs.unlinkSync(path.join(dir,'server-info.json'));host=startHost();server=await info();assert.deepEqual(await(await request(server,'GET')).json(),fixture);
console.log('PASS: EXE API authentication, folder + image write, process restart, readback.');
const browserPath=process.env.ZHIJI_TEST_BROWSER||[process.env['ProgramFiles(x86)'],process.env.ProgramFiles].filter(Boolean).map(p=>path.join(p,'Microsoft','Edge','Application','msedge.exe')).find(p=>fs.existsSync(p));if(!browserPath)throw Error('Set ZHIJI_TEST_BROWSER to a Chromium or Edge executable.');const profile=path.join(dir,'browser');browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,server.origin],{windowsHide:true,stdio:'ignore'});
let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}if(!port)throw Error('Headless browser did not start');
const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
const {targetInfos}=await cdp('Target.getTargets');const target=targetInfos.find(t=>t.type==='page'&&t.url.startsWith(server.origin));assert(target,'app target');const {sessionId}=await cdp('Target.attachToTarget',{targetId:target.targetId,flatten:true});await cdp('Runtime.enable',{},sessionId);await cdp('Emulation.setDeviceMetricsOverride',{width:1320,height:860,deviceScaleFactor:1,mobile:false},sessionId);
await cdp('Page.navigate',{url:server.origin},sessionId);
for(let i=0;i<200;i++){if(await evaluate('typeof ready!=="undefined"&&ready',sessionId))break;await sleep(100);}
if(!await evaluate('typeof ready!=="undefined"&&ready',sessionId))throw Error(await evaluate('JSON.stringify({url:location.href,state:document.readyState,text:document.body?.innerText?.slice(0,800),scripts:document.scripts.length})',sessionId));

assert.equal(await evaluate('ready',sessionId),true);
assert.equal(await evaluate('document.getElementById("export")===null&&!!document.getElementById("export-json")&&!!document.getElementById("open-notes-folder")',sessionId),true);
assert.equal(await evaluate('textStyle({}).Size',sessionId),16);
assert.equal(await evaluate('textStyle({},true).Size',sessionId),20);
assert.equal(await evaluate('textStyle({TextStyle:{Size:13}}).Size',sessionId),13);
for(let i=0;i<100;i++){if(await evaluate('!nativeWindowPending',sessionId))break;await sleep(50);}assert.equal(await evaluate('document.title',sessionId),'枝记');
assert.equal(await evaluate('document.getElementById("tab-title").textContent',sessionId),'笔记');
assert.equal(await evaluate('getComputedStyle(document.querySelector(".nav")).fontSize',sessionId),'15px');
const initialShot=await cdp('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync('preview-v9-default.png',Buffer.from(initialShot.data,'base64'));

async function clickAt(x,y,count=1){await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:count},sessionId);await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:count},sessionId);}
async function blankDoubleClick(){const p=await evaluate('(function(){const r=document.getElementById("canvas").getBoundingClientRect();return{x:r.left+20,y:r.bottom-155}})()',sessionId);await clickAt(p.x,p.y,2);}
const titlePoint=await evaluate('(function(){const r=document.querySelector(".node[data-id=node-test] .rich-text").getBoundingClientRect();const el=document.querySelector(".node[data-id=node-test] .rich-text tspan"),box=el.getExtentOfChar(3),p=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(el.getScreenCTM());return{x:p.x,y:p.y}})()',sessionId);
await clickAt(titlePoint.x,titlePoint.y,2);
assert.equal(await evaluate('!!editor&&editor.e.isContentEditable',sessionId),true,'real double click opens rich editor');

assert.equal(await evaluate('richSelection.start===4&&richSelection.end===4&&window.getSelection().isCollapsed',sessionId),true,'double click places caret after exact clicked glyph');
assert.equal(await evaluate('document.getElementById("inline-toolbar").hidden',sessionId),false);
assert.equal(await evaluate('document.getElementById("inline-size").disabled',sessionId),true);
await evaluate('insertPlainRichText("X")',sessionId);assert.equal(await evaluate('find("node-test").n.Text',sessionId),'图片随笔X记保存');
await evaluate('finishEdit(true)',sessionId);await clickAt(titlePoint.x,titlePoint.y,2);
await evaluate('editor.e.value="普通文字 重点内容 保持原样";editor.e.dispatchEvent(new InputEvent("input",{bubbles:true}));selectEditorRange(5,9);',sessionId);
assert.equal(await evaluate('window.getSelection().toString()',sessionId),'重点内容');
const editingPoint=await evaluate('(function(){const n=editor.e.firstChild.firstChild,r=document.createRange();r.setStart(n,1);r.setEnd(n,2);const b=r.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}})()',sessionId);await clickAt(editingPoint.x,editingPoint.y,2);
assert.equal(await evaluate('richSelection.start===2&&richSelection.end===2&&window.getSelection().isCollapsed',sessionId),true,'double click within active editor also collapses after clicked character');
await evaluate('selectEditorRange(5,9)',sessionId);


const drag=await evaluate('(function(){const n=editor.e.firstChild.firstChild;const a=document.createRange(),b=document.createRange();a.setStart(n,5);a.setEnd(n,6);b.setStart(n,8);b.setEnd(n,9);const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return{sx:x.left+1,sy:x.top+x.height/2,ex:y.right-1,ey:y.top+y.height/2}})()',sessionId);
await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.sx,y:drag.sy},sessionId);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:drag.sx,y:drag.sy,button:'left',clickCount:1},sessionId);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.ex,y:drag.ey,button:'left',buttons:1},sessionId);await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:drag.ex,y:drag.ey,button:'left',clickCount:1},sessionId);
assert.equal(await evaluate('window.getSelection().toString()',sessionId),'重点内容','real mouse drag selects only requested phrase');
assert.equal(await evaluate('document.getElementById("inline-size").disabled',sessionId),false);
for(const [id,value]of [['inline-family','KaiTi'],['inline-size','28'],['inline-color','#d74668']])await evaluate('document.getElementById('+JSON.stringify(id)+').focus();document.getElementById('+JSON.stringify(id)+').value='+JSON.stringify(value)+';document.getElementById('+JSON.stringify(id)+').dispatchEvent(new Event("change",{bubbles:true}))',sessionId);
const toolbarShot=await cdp('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.resolve('dist/preview-toolbar-v9.png'),Buffer.from(toolbarShot.data,'base64'));

assert.equal(await evaluate('!!editor',sessionId),true,'font controls preserve rich editor and selection');
assert.equal(await evaluate('find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Size',sessionId),28);
assert.equal(await evaluate('find("node-test").n.TextRuns[0].Style.Size',sessionId),16,'prefix keeps original size');
assert.equal(await evaluate('find("node-test").n.TextRuns.at(-1).Style.Color',sessionId),'#50505a','suffix keeps original color');
assert(await evaluate('(function(){const a=editor.e.getBoundingClientRect(),b=document.querySelector(".map-attachment image").getBoundingClientRect();return a.bottom<=b.top+2;})()',sessionId),'rich editor does not cover attached image');
await evaluate('document.getElementById("font-close").click();finishEdit()',sessionId);
assert.equal(await evaluate('getComputedStyle([...document.querySelectorAll(".node[data-id=node-test] .rich-text tspan")].find(e=>e.textContent==="重点内容")).fontSize',sessionId),'28px');
assert.equal(await evaluate('getComputedStyle([...document.querySelectorAll(".node[data-id=node-test] .rich-text tspan")].find(e=>e.textContent==="普通文字 ")).fontSize',sessionId),'16px');
await evaluate('undo();undo();undo()',sessionId);assert.equal(await evaluate('find("node-test").n.TextRuns.some(r=>r.Style.Size===28)',sessionId),false);
await evaluate('undo(true);undo(true);undo(true);setView("outline")',sessionId);
assert.equal(await evaluate('getComputedStyle([...document.querySelectorAll(".rich-label span")].find(e=>e.textContent==="重点内容")).fontSize',sessionId),'28px');
await evaluate('startEdit("node-test");selectEditorRange(0,4);document.getElementById("font-button").click();document.getElementById("font-family").value="SimSun";document.getElementById("font-size").value="20";document.getElementById("font-color").value="#286aa8";document.getElementById("font-apply").click();document.getElementById("font-close").click();finishEdit()',sessionId);
assert.equal(await evaluate('find("node-test").n.TextRuns[0].Style.Size',sessionId),20);
assert.equal(await evaluate('find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Color',sessionId),'#d74668');
assert.equal(await evaluate('getComputedStyle(document.querySelector("#outline h1 span")).color',sessionId),'rgb(48, 49, 57)');
const richShot=await cdp('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.resolve('dist/preview-rich-v9.png'),Buffer.from(richShot.data,'base64'));
await blankDoubleClick();assert.equal(await evaluate('selectedId',sessionId),null,'blank double click clears topic');
assert.equal(await evaluate('doc().Items.length',sessionId),1,'deselect does not delete topics');
await evaluate('document.querySelector(".attachment").click()',sessionId);
assert.equal(await evaluate('!!selectedImage',sessionId),true);assert.equal(await evaluate('document.getElementById("modal-root").innerHTML',sessionId),'','single image click selects without opening preview');
assert.equal(await evaluate('document.querySelectorAll(".image-selected").length>0',sessionId),true);
await blankDoubleClick();assert.equal(await evaluate('selectedImage',sessionId),null,'blank double click clears image');assert.equal(await evaluate('selectedId',sessionId),null);
await evaluate('setView("map");document.querySelector(".map-attachment").dispatchEvent(new MouseEvent("click",{bubbles:true}))',sessionId);assert.equal(await evaluate('!!selectedImage',sessionId),true);
await blankDoubleClick();assert.equal(await evaluate('selectedImage',sessionId),null);assert.equal(await evaluate('selectedId',sessionId),null,'map deselects both');
const imagePoint=await evaluate('(function(){const r=document.querySelector(".map-attachment image").getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()',sessionId);await clickAt(imagePoint.x,imagePoint.y,2);assert.equal(await evaluate('!!document.querySelector(".image-preview")',sessionId),true);
await evaluate('document.querySelector(".modal-backdrop").dispatchEvent(new MouseEvent("dblclick",{bubbles:true}))',sessionId);assert.equal(await evaluate('document.getElementById("modal-root").innerHTML',sessionId),'');assert.equal(await evaluate('selectedId',sessionId),null);
await evaluate('startEdit("node-test");editor.e.value="普通文字 重点内容 保持原样";editor.e.dispatchEvent(new InputEvent("input",{bubbles:true}));finishEdit(true);',sessionId);
assert.equal(await evaluate('find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Size',sessionId),28,'cancel preserves prior saved formatting');

await evaluate('startEdit("node-test");editor.e.value="第一行第二行";editor.e.dispatchEvent(new InputEvent("input",{bubbles:true}));selectEditorRange(3,3);editor.e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",shiftKey:true,bubbles:true,cancelable:true}));selectEditorRange(4,7)',sessionId);
assert.equal(await evaluate('window.getSelection().toString()',sessionId),'第二行');
assert.equal(await evaluate('find("node-test").n.Text',sessionId),'第一行\n第二行'.replace('\\n','\n'));
await evaluate('document.getElementById("font-button").click();document.getElementById("font-family").value="SimSun";document.getElementById("font-size").value="32";document.getElementById("font-color").value="#286aa8";document.getElementById("font-apply").click();document.getElementById("font-close").click()',sessionId);
assert.equal(await evaluate('find("node-test").n.TextRuns.find(r=>r.Text==="第二行").Style.Size',sessionId),32);await evaluate('finishEdit(true);transform.k=0.65;applyTransform();startEdit("node-test");resizeRichEditor()',sessionId);
assert(await evaluate('(function(){const a=editor.e.getBoundingClientRect(),b=document.querySelector(".map-attachment image").getBoundingClientRect();return a.bottom<=b.top+2})()',sessionId),'zoomed rich editor leaves image visible');
await evaluate('finishEdit(true);fitMap()',sessionId);


await evaluate('setView("outline")',sessionId);
const outlinePoint=await evaluate('(function(){const n=document.querySelector(".rich-label span").firstChild;const r=document.createRange();r.setStart(n,1);r.setEnd(n,2);const b=r.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}})()',sessionId);await clickAt(outlinePoint.x,outlinePoint.y,2);
assert.equal(await evaluate('richSelection.start===2&&richSelection.end===2',sessionId),true,'outline exact-character caret');
await evaluate('selectEditorRange(5,9);document.getElementById("inline-bold").click();document.getElementById("inline-italic").click();document.getElementById("inline-underline").click();document.getElementById("inline-highlight").value="#fff176";document.getElementById("inline-highlight").dispatchEvent(new Event("change",{bubbles:true}))',sessionId);
assert.equal(await evaluate('find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Bold',sessionId),true);assert.equal(await evaluate('find("node-test").n.TextRuns[0].Style.Bold',sessionId),false);
await evaluate('document.getElementById("inline-done").click();setView("map")',sessionId);assert.equal(await evaluate('document.getElementById("inline-toolbar").hidden',sessionId),true);assert.equal(await evaluate('document.querySelectorAll(".rich-highlights rect").length>0',sessionId),true);
async function clickSelector(selector){const p=await evaluate('(function(){const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()',sessionId);await clickAt(p.x,p.y);await sleep(40);}
await evaluate('startEdit("node-test");selectEditorRange(5,9)',sessionId);
await clickSelector('#inline-color');assert.equal(await evaluate('!!editor&&!document.getElementById("text-color-popup").hidden',sessionId),true);
await clickSelector('[data-color="#326eaa"]');assert.equal(await evaluate('!!editor&&window.getSelection().toString()==="重点内容"',sessionId),true);
assert.equal(await evaluate('find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Color',sessionId),'#326eaa');
await clickSelector('#inline-highlight');await clickSelector('[data-color="#c8e6c9"]');assert.equal(await evaluate('!!editor',sessionId),true);
await clickSelector('#inline-color');await clickSelector('#color-hex');await evaluate('document.getElementById("color-hex").select()',sessionId);await cdp('Input.insertText',{text:'#aa587b'},sessionId);await clickSelector('#color-apply');
assert.equal(await evaluate('!!editor&&find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Color==="#aa587b"',sessionId),true);
await clickSelector('#inline-highlight');await clickSelector('#color-clear');assert.equal(await evaluate('!!editor&&find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Highlight===""',sessionId),true);
await clickSelector('#inline-highlight');await clickSelector('[data-color="#fff176"]');
await evaluate('finishEdit()',sessionId);const runsBeforeTheme=await evaluate('JSON.stringify(find("node-test").n.TextRuns)',sessionId);
await clickSelector('#interface-theme');for(const id of ['lavender','sage','sky','sand','rose']){await clickSelector('[data-theme="'+id+'"]');assert.equal(await evaluate('document.documentElement.dataset.interfaceTheme',sessionId),id);}
assert.equal(await evaluate('JSON.stringify(find("node-test").n.TextRuns)',sessionId),runsBeforeTheme);
const shot=await cdp('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync('preview-v9-theme.png',Buffer.from(shot.data,'base64'));
await clickSelector('#theme-close');
await evaluate('save()',sessionId);for(let i=0;i<100;i++){if(await evaluate('savedVersion===changedVersion',sessionId))break;await sleep(50);}
const saved=JSON.parse(fs.readFileSync(path.join(dir,'notes.json'),'utf8'));assert.equal(saved.Documents[0].Items[0].TextRuns.find(r=>r.Text==='重点内容').Style.Family,'KaiTi');
await evaluate('window.__beforeReload=true',sessionId);await cdp('Page.reload',{},sessionId);for(let i=0;i<200;i++){if(await evaluate('!window.__beforeReload&&typeof ready!=="undefined"&&ready&&!!find("node-test")',sessionId))break;await sleep(50);}
assert.equal(await evaluate('find("node-test").n.TextRuns.find(r=>r.Text==="重点内容").Style.Size',sessionId),28);assert.equal(await evaluate('find("node-test").n.Images.length',sessionId),1);
assert.equal(await evaluate('library.Settings.InterfaceTheme',sessionId),'rose');assert.equal(await evaluate('document.documentElement.dataset.interfaceTheme',sessionId),'rose');assert.deepEqual(errors,[]);console.log('PASS: real pointer color/highlight palettes, custom color input, clear highlight, preserved editing selection, five themes and persisted theme after reload.');console.log('PASS: native double-click editor, selected-range font size/type/color with unchanged surrounding text, images while editing, undo/redo, both views, disk/reload, and blank double-click deselection for topics and images.');
await cdp('Browser.close');ws=null;
}finally{if(ws)ws.close();if(browser)browser.kill();if(host)host.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
