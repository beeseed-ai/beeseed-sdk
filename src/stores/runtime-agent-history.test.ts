import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import type { Message } from '../core/types.js'
import { createMessagesStore } from './messages.js'
import { runtimeHistoryMessages, runtimeRunLoop, runtimeRunNeedsRefreshRecovery, runtimeRunTranscript } from './runtime-agent-history.js'
import type { RuntimeRunEvent, RuntimeRunSummary } from './runtime-agent-history.js'

const run: RuntimeRunSummary = { run_id:'run-a',channel_id:'channel-a',agent_id:'agent-a',status:'completed',created_at:'2026-09-15T01:00:00Z',started_at:'2026-09-15T01:00:01Z',completed_at:'2026-09-15T01:01:00Z' }
const message: Message = { id:42,channel_id:'channel-a',sender_type:'agent',sender_agent_id:'agent-a',msg_type:'text',content:'实际结果 storage://result.md',metadata:{source:'reasonix_runtime',run_id:'run-a'},created_at:'2026-09-15T01:01:00Z' }
const event = (seq:number,update:Record<string,unknown>):RuntimeRunEvent => ({run_id:'run-a',runtime_epoch:2,seq,event_type:'reasonix.acp',created_at:`2026-09-15T01:00:${String(seq+1).padStart(2,'0')}Z`,payload:{method:'session/update',params:{update}}})
const events = [
  event(1,{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'开始整理'}}),
  event(2,{sessionUpdate:'tool_call',toolCallId:'call-1',title:'storage_write',rawInput:{key:'result.md'}}),
  event(3,{sessionUpdate:'tool_call_update',toolCallId:'call-1',status:'completed',rawOutput:{type:'text',text:'已保存'}}),
  event(4,{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'完成'}}),
]

describe('runtime history adapter',()=>{
  it('uses persisted terminal status rather than treating final text as success',()=>{
    expect(runtimeRunLoop({...run,status:'failed',failure_detail:'测试失败'},'已有部分文本')).toMatchObject({status:'error',error:'测试失败',historySource:'runtime'})
    expect(runtimeRunLoop({...run,status:'canceled'}).status).toBe('stopped')
    expect(runtimeRunLoop({...run,status:'waiting_user'}).status).toBe('waiting_for_user')
  })
  it('replays from the first event, orders and deduplicates by run epoch and sequence',()=>{
    const loop=runtimeRunTranscript({run,events:[events[3],events[1],events[0],events[2],events[2],{...events[0],run_id:'other-run'}]},message.content)
    expect(loop.events?.map(x=>x.seq)).toEqual([1,2,3,4])
    expect(loop.events?.[0]).toMatchObject({content:'开始整理',timestamp:Date.parse(events[0].created_at!)})
    expect(loop.turns[0].toolCalls).toHaveLength(1)
    expect(loop.turns[0].toolCalls[0]).toMatchObject({name:'storage_write',status:'success',output:'已保存',args:{key:'result.md'}})
    expect(loop).toMatchObject({status:'completed',finalContent:message.content})
  })
  it('replays redacted Cloudflare text and platform capability evidence',()=>{
    const cloudflareEvent=(seq:number,runtimeType:string,payload:Record<string,unknown>):RuntimeRunEvent=>({
      run_id:'run-a',runtime_epoch:3,seq,event_type:'cloudflare.think',created_at:`2026-09-15T01:00:${String(seq+10).padStart(2,'0')}Z`,
      payload:{runtime_type:runtimeType,event:payload},
    })
    const cloudflareEvents=[
      cloudflareEvent(1,'tool',{phase:'started',callId:'cf-call-1',name:'knowledge_search',inputDigest:'sha256:redacted'}),
      cloudflareEvent(2,'tool',{phase:'completed',callId:'cf-call-1',name:'knowledge_search',success:true,status:200}),
      cloudflareEvent(3,'chunk',{type:'text-delta',delta:'知识'}),
      cloudflareEvent(4,'chunk',{type:'text-delta',delta:'结果'}),
    ]
    const loop=runtimeRunTranscript({run,events:cloudflareEvents})
    expect(loop.events?.map(item=>item.type)).toEqual(['tool_call','tool_result','assistant_content'])
    expect(loop.events?.at(-1)).toMatchObject({content:'知识结果'})
    expect(loop.turns[0].toolCalls).toEqual([expect.objectContaining({
      toolCallId:'cf-call-1',name:'knowledge_search',status:'success',
    })])
    expect(JSON.stringify(loop)).not.toContain('sha256:redacted')
  })
  it('does not expose thought text or provider configuration as chat content',()=>{
    const loop=runtimeRunTranscript({run,events:[event(1,{sessionUpdate:'agent_thought_chunk',content:{type:'text',text:'private reasoning'}}),event(2,{configOptions:[{value:'private-config'}]})]})
    expect(JSON.stringify(loop)).not.toContain('private reasoning')
    expect(JSON.stringify(loop)).not.toContain('private-config')
    expect(loop.events?.[0].summary).toBe('Agent 正在思考…')
  })
  it('only selects messages with runtime history references',()=>{
    expect(runtimeHistoryMessages([message,{...message,metadata:{source:'agent_loop',run_id:'old-run'}},{...message,metadata:{source:'reasonix_runtime'}},{...message,sender_type:'user'}])).toEqual([message])
  })
  it('does not reopen a completed run when a summary response arrives late',()=>{
    const completed=runtimeRunLoop(run,message.content)
    const late=runtimeRunLoop({...run,status:'running',completed_at:undefined},message.content,completed)
    expect(late).toMatchObject({status:'completed',completedAt:completed.completedAt})
  })
  it('counts queue preparation in the displayed total duration',()=>{
    const queuedAt='2026-09-15T00:59:50Z'
    const loop=runtimeRunLoop({...run,queued_at:queuedAt})
    expect(loop.startedAt).toBe(Date.parse(queuedAt))
    expect(loop.completedAt! - loop.startedAt).toBe(70_000)
  })
  it('restores every non-completed runtime status after refresh',()=>{
    for (const status of ['queued','starting','running','waiting_tool','waiting_user','waiting_external','canceling','failed','timed_out']) {
      expect(runtimeRunNeedsRefreshRecovery({...run,status})).toBe(true)
    }
    expect(runtimeRunNeedsRefreshRecovery(run)).toBe(false)
  })
})

function fixture() {
  let page=0
  const get=vi.fn((path:string,options?:{searchParams?:Record<string,string>})=>{
    let body:unknown
    if(path==='channels/channel-a/messages') body=options?.searchParams?.before?[{...message,id:21,metadata:{source:'reasonix_runtime',run_id:'run-old'}}]:[message]
    else if(path==='channels/channel-a/agent-runs') body={runs:[{...run,run_id:page++?'run-old':'run-a'}, {...run,run_id:'hidden-run'}, {...run,channel_id:'channel-b'}]}
    else if(path==='channels/channel-a/agent-runs/run-a') body={run,events}
    else if(path==='local-agent/runs') body={runs:[]}
    else throw Error('unexpected path '+path)
    const response=new Response(JSON.stringify(body),{headers:{'X-BeeSeed-Has-Older':'true','X-BeeSeed-Next-Before':'42'}})
    return Object.assign(Promise.resolve(response),{json:async()=>body})
  })
  return {get,store:createMessagesStore({api:{get} as unknown as KyInstance,getCurrentUserId:()=> 'user-a',getCurrentChannelId:()=> 'channel-a',sendWsCommand:()=>{}})}
}

describe('runtime history loading',()=>{
  it('restores a compact card after refresh and loads full events only when opened',async()=>{
    const {get,store}=fixture()
    await store.getState().fetchMessages('channel-a')
    let loops=[...store.getState().agentLoops.values()]
    expect(loops).toHaveLength(1)
    expect(loops[0]).toMatchObject({runId:'run-a',status:'completed',finalContent:message.content,historySource:'runtime'})
    expect(get.mock.calls.some(([p])=>p.endsWith('/agent-runs/run-a'))).toBe(false)
    await store.getState().loadAgentRunDetails('channel-a','agent-a','run-a')
    loops=[...store.getState().agentLoops.values()]
    expect(loops[0].events?.[0].content).toBe('开始整理')
    await store.getState().loadAgentRunDetails('channel-a','agent-a','run-a')
    expect(get.mock.calls.filter(([p])=>p.endsWith('/agent-runs/run-a'))).toHaveLength(1)
  })
  it('restores queued and running cards plus typing after a hard refresh',async()=>{
    const activeRuns:RuntimeRunSummary[]=[
      {...run,run_id:'run-queued',status:'queued',queued_at:'2026-09-15T01:02:00Z',started_at:undefined,completed_at:undefined},
      {...run,run_id:'run-running',agent_id:'agent-b',status:'running',queued_at:'2026-09-15T01:03:00Z',completed_at:undefined},
    ]
    const get=vi.fn((path:string)=>{
      const body=path==='channels/channel-a/messages' ? []
        : path==='channels/channel-a/agent-runs' ? {runs:activeRuns}
          : path==='local-agent/runs' ? {runs:[]} : (()=>{throw Error('unexpected path '+path)})()
      return Object.assign(Promise.resolve(new Response(JSON.stringify(body))),{json:async()=>body})
    })
    const store=createMessagesStore({api:{get} as unknown as KyInstance,getCurrentUserId:()=> 'user-a',getCurrentChannelId:()=> 'channel-a',sendWsCommand:()=>{}})
    await store.getState().fetchMessages('channel-a')
    expect(store.getState().getAgentLoops('channel-a').map(loop=>loop.runId).sort()).toEqual(['run-queued','run-running'])
    expect(store.getState().getTypings('channel-a')).toEqual(expect.arrayContaining([
      {agentId:'agent-a',text:'准备中'},
      {agentId:'agent-b',text:'思考中'},
    ]))
  })
  it('does not let a stale HTTP snapshot reopen typing after a live terminal event',async()=>{
    let resolveRuns:(value:unknown)=>void=()=>{}
    const runsResponse=new Promise(resolve=>{resolveRuns=resolve})
    const get=vi.fn((path:string)=>{
      if(path==='channels/channel-a/messages') return Object.assign(Promise.resolve(new Response('[]')),{json:async()=>[]})
      if(path==='channels/channel-a/agent-runs') return Object.assign(runsResponse,{json:async()=>runsResponse})
      if(path==='local-agent/runs') return Object.assign(Promise.resolve(new Response('{"runs":[]}')),{json:async()=>({runs:[]})})
      throw Error('unexpected path '+path)
    })
    const store=createMessagesStore({api:{get} as unknown as KyInstance,getCurrentUserId:()=> 'user-a',getCurrentChannelId:()=> 'channel-a',sendWsCommand:()=>{}})
    const loading=store.getState().fetchMessages('channel-a')
    store.getState().handleEvent({type:'agent_ack',channel_id:'channel-a',agent_id:'agent-a',run_id:'run-stale',turn:1})
    store.getState().handleEvent({type:'agent_run_status',channel_id:'channel-a',agent_id:'agent-a',run_id:'run-stale',status:'running'})
    store.getState().handleEvent({type:'agent_run_status',channel_id:'channel-a',agent_id:'agent-a',run_id:'run-stale',status:'completed'})
    resolveRuns({runs:[{...run,run_id:'run-stale',status:'running',completed_at:undefined}]})
    await loading
    expect(store.getState().getTyping('channel-a')).toBe('')
    expect(store.getState().getAgentLoops('channel-a').find(loop=>loop.runId==='run-stale')?.status).toBe('completed')
  })
  it('loads only older visible run references without replacing the current run',async()=>{
    const {store}=fixture()
    await store.getState().fetchMessages('channel-a')
    await store.getState().loadOlderMessages('channel-a')
    expect([...store.getState().agentLoops.values()].map(x=>x.runId).sort()).toEqual(['run-a','run-old'])
  })
})
