import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import type { Message } from '../core/types.js'
import { createMessagesStore } from './messages.js'
import { runtimeHistoryMessages, runtimeRunLoop, runtimeRunTranscript } from './runtime-agent-history.js'
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
  it('loads only older visible run references without replacing the current run',async()=>{
    const {store}=fixture()
    await store.getState().fetchMessages('channel-a')
    await store.getState().loadOlderMessages('channel-a')
    expect([...store.getState().agentLoops.values()].map(x=>x.runId).sort()).toEqual(['run-a','run-old'])
  })
})
