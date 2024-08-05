const b=require('blessed'),fs=require('fs'),p=require('path'),m=require('gray-matter'),ax=require('axios');

const d='/Users/ejfox/Library/Mobile Documents/iCloud~md~obsidian/Documents/ejfox/drafts',
s=b.screen({smartCSR:true}),
main=b.box({parent:s,top:0,left:0,width:'100%',height:'100%'}),
title=b.text({parent:main,top:0,left:'center',content:'Draft Assistant'}),
status=b.text({parent:main,bottom:0,left:0,right:0,height:1}),
draftList=b.list({
  parent:main,
  top:2,
  left:0,
  width:'100%',
  height:'100%-3',
  keys:true,
  vi:true,
  mouse:true,
  items:[],
  style:{selected:{inverse:true}}
}),
content=b.box({
  parent:main,
  top:2,
  left:0,
  width:'100%',
  height:'100%-3',
  hidden:true,
  content:'',
  scrollable:true,
  alwaysScroll:true,
  keys:true,
  vi:true,
  mouse:true,
  wrap:true,
  tags:true
});

const gdi=f=>{const c=fs.readFileSync(p.join(d,f),'utf-8'),{data,content:body}=m(c);return{f,dek:data.dek||'No dek',mt:fs.statSync(p.join(d,f)).mtime,content:body,wc:body.split(/\s+/).length,hc:body.split('\n').filter(l=>l.startsWith('#')).length,...data}};

let displayDrafts = [];

const ld=()=>{
  const allDrafts=fs.readdirSync(d).filter(f=>f.endsWith('.md')&&!f.startsWith('!')).map(f=>({f,...gdi(f)})).sort((a,b)=>b.mt-a.mt);
  const recentDrafts=allDrafts.slice(0,3);
  const otherDrafts=allDrafts.slice(3);
  const randomDrafts=otherDrafts.sort(()=>0.5-Math.random()).slice(0,2);
  displayDrafts=[...recentDrafts,...randomDrafts,...otherDrafts];
  draftList.setItems(displayDrafts.map((d,i)=>`${i<3?'▶':i<5?'?':'✧'} ${d.f} - ${d.dek} (${d.wc} words, ${d.hc} headers)`));
  draftList.select(0);
  draftList.focus();
  draftList.show();
  content.hide();
  status.setContent('↑↓:Navigate | Enter:Select | z:Zoom | q:Quit');
  s.render();
};

const formatText = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '{bold}$1{/bold}')
    .replace(/\*(.*?)\*/g, '{italic}$1{/italic}')
    .replace(/`(.*?)`/g, '{underline}$1{/underline}')
    .replace(/^# (.*$)/gm, '{bold}$1{/bold}')
    .replace(/^## (.*$)/gm, '{bold}$1{/bold}')
    .replace(/^### (.*$)/gm, '{bold}$1{/bold}');
};

const gt=async draft=>{
  content.setContent('Analyzing draft...');
  draftList.hide();
  content.show();
  content.focus();
  s.render();

  try {
    const src=ax.CancelToken.source();
    const resp=await ax.post('http://localhost:1234/v1/chat/completions',{
      model:'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
      messages:[{role:'user',content:`Analyze this draft and suggest 3 different paths for improvement. Format as "1. Path name: description", "2. Path name: description", etc.:\n\n${draft.content}`}],
      stream:true
    },{
      responseType:'stream',
      cancelToken:src.token
    });

    let pathOutput='';
    resp.data.on('data',chunk=>{
      const lines=chunk.toString().split('\n').filter(line=>line.trim()!=='');
      for(const line of lines){
        if(line.includes('data: [DONE]'))return;
        if(line.startsWith('data: '))try{
          const parsed=JSON.parse(line.slice(6));
          pathOutput+=parsed.choices[0].delta.content||'';
          content.setContent(formatText(pathOutput));
          s.render();
        }catch(e){}
      }
    });

    resp.data.on('end',()=>{
      status.setContent(`Paths for ${draft.f} | '1-3' select path, 'b' back to drafts`);
      s.render();
    });

  } catch(e) {
    content.setContent(`Error: ${e.message}`);
  }
  s.render();
};

const getSteps=async(draft,path)=>{
  content.setContent('Generating steps...');
  s.render();

  try {
    const resp=await ax.post('http://localhost:1234/v1/chat/completions',{
      model:'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
      messages:[{role:'user',content:`Given this draft and improvement path:\n\n${draft.content}\n\nPath: ${path}\n\nProvide a numbered list of specific steps to improve the draft.`}],
      stream:true
    },{responseType:'stream'});

    let stepOutput='';
    resp.data.on('data',chunk=>{
      const lines=chunk.toString().split('\n').filter(line=>line.trim()!=='');
      for(const line of lines){
        if(line.includes('data: [DONE]'))return;
        if(line.startsWith('data: '))try{
          const parsed=JSON.parse(line.slice(6));
          stepOutput+=parsed.choices[0].delta.content||'';
          content.setContent(formatText(stepOutput));
          s.render();
        }catch(e){}
      }
    });

    resp.data.on('end',()=>{
      status.setContent(`Steps for ${path} | 'n' next step, 'b' back to paths`);
      s.render();
    });

  } catch(e) {
    content.setContent(`Error: ${e.message}`);
  }
  s.render();
};

const getGuidance=async(draft,step)=>{
  content.setContent('Fetching guidance...');
  s.render();

  try {
    const resp=await ax.post('http://localhost:1234/v1/chat/completions',{
      model:'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
      messages:[{role:'user',content:`Given this draft:\n\n${draft.content}\n\nProvide specific guidance on how to accomplish this step:\n${step}`}],
      stream:true
    },{responseType:'stream'});

    let guidanceOutput='';
    resp.data.on('data',chunk=>{
      const lines=chunk.toString().split('\n').filter(line=>line.trim()!=='');
      for(const line of lines){
        if(line.includes('data: [DONE]'))return;
        if(line.startsWith('data: '))try{
          const parsed=JSON.parse(line.slice(6));
          guidanceOutput+=parsed.choices[0].delta.content||'';
          content.setContent(formatText(guidanceOutput));
          s.render();
        }catch(e){}
      }
    });
  } catch(e) {
    content.setContent(`Error: ${e.message}`);
  }
  s.render();
};

ld();

let currentDraft,currentPath,currentSteps,currentStepIndex;

draftList.on('select',(_,i)=>{
  currentDraft=displayDrafts[i];
  gt(currentDraft);
});

s.key(['escape','q'],()=>process.exit(0));
s.key(['b'],()=>{
  if(currentSteps){
    currentSteps=null;currentStepIndex=null;
    gt(currentDraft);
  } else if(currentPath){
    currentPath=null;
    gt(currentDraft);
  } else {
    currentDraft=null;currentPath=null;currentSteps=null;currentStepIndex=null;
    content.hide();
    draftList.show();
    draftList.focus();
    status.setContent('↑↓:Navigate | Enter:Select | z:Zoom | q:Quit');
  }
  s.render();
});
s.key(['1','2','3'],(_,key)=>{
  if(content.visible && !currentPath){
    const paths = content.getContent().split('\n').filter(l => l.match(/^\d+\./));
    currentPath = paths[parseInt(key)-1];
    getSteps(currentDraft,currentPath);
  }
});
s.key(['n'],()=>{
  if(content.visible && currentPath){
    if(!currentSteps){
      currentSteps = content.getContent().split('\n').filter(l => l.match(/^\d+\./));
      currentStepIndex = 0;
    } else {
      currentStepIndex = (currentStepIndex + 1) % currentSteps.length;
    }
    getGuidance(currentDraft, currentSteps[currentStepIndex]);
    status.setContent(`Step ${currentStepIndex+1}/${currentSteps.length} | 'n' next, 'b' back`);
    s.render();
  }
});
s.key(['z'],()=>{
  if(draftList.visible){
    const selectedDraft = displayDrafts[draftList.selected];
    if(selectedDraft){
      const meta=Object.entries(selectedDraft).filter(([k])=>!['f','content','mt'].includes(k)).map(([k,v])=>`${k}: ${v}`).join('\n');
      content.setContent(meta);
      draftList.hide();
      content.show();
      status.setContent('b:Back');
      s.render();
    }
  }
});

s.render();