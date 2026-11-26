import type { FormEvent } from 'react';
import { Activity, Award, CalendarDays, ChevronDown, CircleHelp, Filter, Inbox, LayoutDashboard, Plus, Search, Settings2, Trophy, Upload, Users, Zap, X, Mail, Clock, CheckCircle2, Link2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import HackathonDiscovery, { type FeaturedHackathon } from './HackathonDiscovery';

type Hackathon = { id: string; name: string; platform: string; status: 'Interested' | 'Registered' | 'In progress' | 'Submitted' | 'Completed'; startDate: string; endDate: string; submissionUrl?: string; notes?: string };
const nav = [{label:'Overview',icon:LayoutDashboard},{label:'Hackathons',icon:CalendarDays},{label:'Submissions',icon:Upload},{label:'Achievements',icon:Trophy},{label:'Email discoveries',icon:Inbox,count:'0'}];
const emptyStats = [{label:'Hackathons tracked',note:'Your journey starts here',icon:CalendarDays},{label:'Projects submitted',note:'Submission history',icon:Upload},{label:'Achievements',note:'Wins and finalist spots',icon:Award},{label:'Currently active',note:'Events in progress',icon:Activity}];
const STORAGE_KEY = 'hacktony-hackathons-v1';
const DISCOVERY_KEY = 'hacktony-gmail-discoveries-v1';
const CLIENT_KEY = 'hacktony-google-client-id';
type Discovery = {id:string;subject:string;from:string;date:string;snippet:string;platform:string;matchedAt:string};

type RepoPulseLink = { eventId:string; eventName:string; repositoryFullName:string; repositoryUrl:string; projectName:string; branch:string; linkedAt:string };
const PROJECT_LINKS_KEY = 'hacktony-repopulse-links-v1';
const REPOPULSE_URL_KEY = 'hacktony-repopulse-app-url-v1';
function parseGitHubRepository(input:string){
  try{
    const url=new URL(input.trim());
    if(url.protocol!=='https:'||url.hostname.toLowerCase()!=='github.com'||url.username||url.password)return null;
    const parts=url.pathname.split('/').filter(Boolean);
    if(parts.length!==2)return null;
    const owner=parts[0];
    const repo=parts[1].replace(/\.git$/i,'');
    if(!/^[A-Za-z0-9_.-]+$/.test(owner)||! /^[A-Za-z0-9_.-]+$/.test(repo))return null;
    return {owner,repo,fullName:owner+'/'+repo,url:'https://github.com/'+owner+'/'+repo};
  }catch{return null;}
}
function buildRepoPulseDeepLink(baseUrl:string,link:RepoPulseLink){
  try{
    const url=new URL(baseUrl.trim());
    if(!['https:','http:'].includes(url.protocol))return '';
    url.searchParams.set('repo',link.repositoryFullName);
    url.searchParams.set('source','hacktony');
    url.searchParams.set('hackathon',link.eventName);
    url.searchParams.set('hackathonId',link.eventId);
    if(link.branch)url.searchParams.set('branch',link.branch);
    return url.toString();
  }catch{return '';}
}


type DiscoveryGroup = { key:string; name:string; platform:string; messages:Discovery[]; suggestedStatus:Hackathon['status']; latestDate:string };
const STATUS_RANK:Record<Hackathon['status'],number>={Interested:0,Registered:1,'In progress':2,Submitted:3,Completed:4};
function normalizeEventName(value:string){
  return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function inferEventName(subject:string,snippet=''){
  const original=subject.trim();
  let value=original.replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/ig,'').replace(/^\[[^\]]+\]\s*/,'').trim();
  const leading=[
    /^(?:registration\s+(?:confirmed|confirmation)|you(?:'re| are)\s+(?:successfully\s+)?registered|successfully\s+registered|thanks\s+for\s+registering)\s*(?:for|to|at)?\s*[:\-–—]?\s*/i,
    /^(?:submission\s+(?:received|confirmation)|we\s+received\s+your\s+submission|project\s+submitted|thanks\s+for\s+submitting)\s*(?:for|to|in)?\s*[:\-–—]?\s*/i,
    /^(?:you(?:'ve| have)\s+been\s+(?:selected|shortlisted|named|awarded)|congratulations!?|finalist(?:s)?|winner(?:s)?)\s*(?:for|of|in)?\s*[:\-–—]?\s*/i,
    /^(?:certificate\s+of\s+participation|participation\s+certificate)\s*(?:for|in)?\s*[:\-–—]?\s*/i,
  ];
  for(const pattern of leading)value=value.replace(pattern,'');
  value=value.replace(/\s*(?:[-|:–—])\s*(?:your\s+)?(?:registration\s+(?:is\s+)?confirmed|registration\s+confirmation|submission\s+(?:received|confirmation)|we\s+received\s+your\s+submission|thank\s+you\s+for\s+registering|participation\s+certificate|certificate\s+of\s+participation)\s*$/i,'');
  value=value.replace(/\s+(?:registration\s+(?:is\s+)?confirmed|registration\s+confirmation|submission\s+(?:received|confirmation)|submission\s+successful|application\s+received)\s*$/i,'');
  value=value.replace(/\s*[-|:–—]\s*(?:Devpost|Unstop|HackerEarth|Devfolio|MLH)\s*$/i,'');
  value=value.replace(/^[\s:|–—-]+|[\s:|–—-]+$/g,'').trim();
  const generic=['hackathon','competition','event','registration','submission'];
  if(value&&!generic.includes(normalizeEventName(value)))return value;
  const fromSnippet=snippet.match(/(?:registered|registration confirmed|registration successful|submitted|submission received|participating|selected|shortlisted|finalist|winner|certificate of participation)\s+(?:for|to|in|at)\s+(?:the\s+)?([^.!?;\n]{4,100})/i)?.[1]?.trim();
  if(fromSnippet&&!generic.includes(normalizeEventName(fromSnippet)))return fromSnippet.replace(/\s+on\s+(?:Devpost|Unstop|HackerEarth|Devfolio).*$/i,'').trim();
  return value||original;
}
function inferredStatus(messages:Discovery[]):Hackathon['status']{
  const text=messages.map(m=>m.subject+' '+m.snippet).join(' ').toLowerCase();
  if(/\b(winner|won|finalist|certificate of participation|participation certificate|prize winner|award recipient)\b/.test(text))return 'Completed';
  if(/\b(submitted|submission received|submission successful|project uploaded|submission confirmation|your project is live)\b/.test(text))return 'Submitted';
  if(/\b(registered|registration confirmed|registration successful|ticket confirmed|successfully enrolled)\b/.test(text))return 'Registered';
  if(/\b(accepted|invited|shortlisted|shortlist|team created|team formation|welcome to the hackathon|participating in)\b/.test(text))return 'In progress';
  return 'Interested';
}
function displayPlatform(platform:string){
  const host=platform.toLowerCase().replace(/^www\./,'');
  if(host.includes('devpost'))return 'Devpost';
  if(host.includes('unstop'))return 'Unstop';
  if(host.includes('hackerearth'))return 'HackerEarth';
  if(host.includes('devfolio'))return 'Devfolio';
  if(host.includes('mlh'))return 'Major League Hacking';
  return platform || 'Email';
}
function groupDiscoveries(messages:Discovery[]):DiscoveryGroup[]{
  const grouped=new Map<string,Discovery[]>();
  for(const message of messages){
    const name=inferEventName(message.subject,message.snippet);
    const normalized=normalizeEventName(name);
    const generic=['hackathon','competition','event','registration','submission'].includes(normalized);
    const key=generic?'message '+message.id:(normalized||('message '+message.id));
    const list=grouped.get(key)||[];
    list.push(message);
    grouped.set(key,list);
  }
  return Array.from(grouped.entries()).map(([key,items])=>{
    const sorted=[...items].sort((a,b)=>Date.parse(b.date||'')-Date.parse(a.date||''));
    const name=inferEventName(sorted[0]?.subject||'Hackathon',sorted[0]?.snippet||'');
    return {key,name,platform:displayPlatform(sorted[0]?.platform||'Email'),messages:sorted,suggestedStatus:inferredStatus(sorted),latestDate:sorted[0]?.date||''};
  }).sort((a,b)=>(Date.parse(b.latestDate||'')||0)-(Date.parse(a.latestDate||'')||0));
}

export default function App(){
  const [page,setPage] = useState('Overview');
  const [timePeriod,setTimePeriod] = useState<'All time'|'This year'|'This month'>('All time');
  const [events,setEvents] = useState<Hackathon[]>([]);
  const [modal,setModal] = useState(false);
  const [eventUrl,setEventUrl] = useState('');
  const [importBusy,setImportBusy] = useState(false);
  const [importMessage,setImportMessage] = useState('');
  const [importPreview,setImportPreview] = useState<any>(null);
  const [search,setSearch] = useState('');
  const [clientId,setClientId] = useState(()=>localStorage.getItem(CLIENT_KEY)||'');
  const [gmailToken,setGmailToken] = useState('');
  const [gmailMessage,setGmailMessage] = useState('');
  const [discoveries,setDiscoveries] = useState<Discovery[]>(()=>{try{return JSON.parse(localStorage.getItem(DISCOVERY_KEY)||'[]')}catch{return []}});
  const [gmailBusy,setGmailBusy] = useState(false);
  const [gmailNextPageToken,setGmailNextPageToken] = useState('');
  const [supabaseUser,setSupabaseUser] = useState<any>(null);
  const [supabaseEmail,setSupabaseEmail] = useState('');
  const [supabaseMessage,setSupabaseMessage] = useState('');
  const [syncBusy,setSyncBusy] = useState(false);
  const [projectLinks,setProjectLinks] = useState<RepoPulseLink[]>(()=>{try{return JSON.parse(localStorage.getItem(PROJECT_LINKS_KEY)||'[]')}catch{return []}});
  const [repoPulseUrl,setRepoPulseUrl] = useState(()=>localStorage.getItem(REPOPULSE_URL_KEY)||'');
  const [repoPulseMessage,setRepoPulseMessage] = useState('');
  const [linkingEvent,setLinkingEvent] = useState<Hackathon|null>(null);
  const [linkDraft,setLinkDraft] = useState({repositoryUrl:'',projectName:'',branch:''});

  const [draft,setDraft] = useState({name:'',platform:'Devpost',status:'Interested' as Hackathon['status'],startDate:'',endDate:'',submissionUrl:'',notes:''});
  useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)setEvents(JSON.parse(raw));}catch{}},[]);
  useEffect(()=>{if(!supabase)return;void supabase.auth.getSession().then(({data})=>setSupabaseUser(data.session?.user??null));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setSupabaseUser(session?.user??null));return ()=>subscription.unsubscribe();},[]);
  useEffect(()=>{
    if(!supabase||!supabaseUser)return;
    let cancelled=false;
    void supabase.from('app_user_connections').select('metadata').eq('user_id',supabaseUser.id).eq('provider','repopulse').eq('external_account_id','workspace').maybeSingle().then(({data,error}:any)=>{
      if(cancelled)return;
      if(error){setRepoPulseMessage('Could not load RepoPulse links: '+error.message);return;}
      const metadata=(data?.metadata||{}) as any;
      const remoteLinks=Array.isArray(metadata.links)?metadata.links as RepoPulseLink[]:[];
      setProjectLinks(local=>{
        const merged=new Map<string,RepoPulseLink>();
        remoteLinks.forEach(link=>merged.set(link.eventId,link));
        local.forEach(link=>merged.set(link.eventId,link));
        return Array.from(merged.values());
      });
      setRepoPulseUrl(local=>local||String(metadata.app_url||''));
    });
    return ()=>{cancelled=true;};
  },[supabaseUser]);

  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(events));}catch{}},[events]);
  useEffect(()=>{try{localStorage.setItem(DISCOVERY_KEY,JSON.stringify(discoveries));}catch{}},[discoveries]);
  useEffect(()=>{try{localStorage.setItem(PROJECT_LINKS_KEY,JSON.stringify(projectLinks));}catch{}},[projectLinks]);
  useEffect(()=>{try{if(repoPulseUrl)localStorage.setItem(REPOPULSE_URL_KEY,repoPulseUrl);else localStorage.removeItem(REPOPULSE_URL_KEY);}catch{}},[repoPulseUrl]);

  const submitted=events.filter(e=>e.status==='Submitted'||e.status==='Completed').length;
  const active=events.filter(e=>e.status==='Registered'||e.status==='In progress').length;
  const achievementCount=[events.length>0,submitted>0,events.length>=5].filter(Boolean).length;
  const stats=emptyStats.map((s,i)=>({...s,value:[events.length,submitted,achievementCount,active][i],note:i===0?(events.length?'Your tracked events':'Your journey starts here'):i===1?(submitted?'Submission history':'No submissions yet'):i===3?(active?'Events underway':'Nothing active yet'):s.note}));
  const visibleEvents=useMemo(()=>events.filter(e=>{if(timePeriod==='All time'||!e.startDate)return true;const date=new Date(e.startDate+'T00:00:00');const now=new Date();return timePeriod==='This year'?date.getFullYear()===now.getFullYear():date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth();}),[events,timePeriod]);
  const filtered=useMemo(()=>events.filter(e=>(e.name+' '+e.platform+' '+e.status).toLowerCase().includes(search.toLowerCase())),[events,search]);
  const groupedDiscoveries=useMemo(()=>groupDiscoveries(discoveries),[discoveries]);
  async function sendMagicLink(){if(!supabase){setSupabaseMessage('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Netlify.');return;}if(!supabaseEmail.trim()){setSupabaseMessage('Enter your email first.');return;}const {error}=await supabase.auth.signInWithOtp({email:supabaseEmail.trim(),options:{emailRedirectTo:window.location.origin}});setSupabaseMessage(error?error.message:'Magic link sent. Check your email and open the link on this browser.');}
  async function syncCloud(){if(!supabase||!supabaseUser){setSupabaseMessage('Sign in to Supabase first.');return;}setSyncBusy(true);setSupabaseMessage('Syncing your HackTony data…');try{const eventRows=events.map(e=>({id:e.id,user_id:supabaseUser.id,event_name:e.name,platform:e.platform,status:e.status,start_date:e.startDate||null,end_date:e.endDate||null,submission_url:e.submissionUrl||null,notes:e.notes||null,updated_at:new Date().toISOString()}));if(eventRows.length){const {error}=await supabase.from('hacktony_events').upsert(eventRows,{onConflict:'id'});if(error)throw error;}const {data:cloudEvents,error:eventError}=await supabase.from('hacktony_events').select('*').eq('user_id',supabaseUser.id).order('updated_at',{ascending:false});if(eventError)throw eventError;const mergedEvents=new Map(events.map(e=>[e.id,e]));(cloudEvents||[]).forEach((r:any)=>mergedEvents.set(r.id,{id:r.id,name:r.event_name,platform:r.platform,status:r.status,startDate:r.start_date||'',endDate:r.end_date||'',submissionUrl:r.submission_url||'',notes:r.notes||''}));setEvents(Array.from(mergedEvents.values()));const discoveryRows=discoveries.map(d=>({user_id:supabaseUser.id,gmail_message_id:d.id,subject:d.subject,sender:d.from,message_date:d.date,snippet:d.snippet,platform:d.platform,matched_at:d.matchedAt,status:'pending_review'}));if(discoveryRows.length){const {error}=await supabase.from('hacktony_gmail_discoveries').upsert(discoveryRows,{onConflict:'user_id,gmail_message_id'});if(error)throw error;}const {data:cloudDiscoveries,error:discoveryError}=await supabase.from('hacktony_gmail_discoveries').select('*').eq('user_id',supabaseUser.id).eq('status','pending_review').order('matched_at',{ascending:false});if(discoveryError)throw discoveryError;const mergedDiscoveries=new Map(discoveries.map(d=>[d.id,d]));(cloudDiscoveries||[]).forEach((r:any)=>mergedDiscoveries.set(r.gmail_message_id,{id:r.gmail_message_id,subject:r.subject,from:r.sender,date:r.message_date,snippet:r.snippet,platform:r.platform,matchedAt:r.matched_at}));setDiscoveries(Array.from(mergedDiscoveries.values()));
  const {data:repoPulseConnection,error:repoPulseLoadError}=await supabase.from('app_user_connections').select('metadata').eq('user_id',supabaseUser.id).eq('provider','repopulse').eq('external_account_id','workspace').maybeSingle();
  if(repoPulseLoadError)throw repoPulseLoadError;
  const cloudMetadata=(repoPulseConnection?.metadata||{}) as any;
  const cloudLinks=Array.isArray(cloudMetadata.links)?cloudMetadata.links as RepoPulseLink[]:[];
  const mergedLinksMap=new Map<string,RepoPulseLink>();
  cloudLinks.forEach(link=>mergedLinksMap.set(link.eventId,link));
  projectLinks.forEach(link=>mergedLinksMap.set(link.eventId,link));
  const mergedProjectLinks=Array.from(mergedLinksMap.values());
  const effectiveRepoPulseUrl=repoPulseUrl||String(cloudMetadata.app_url||'');
  setProjectLinks(mergedProjectLinks);
  setRepoPulseUrl(effectiveRepoPulseUrl);
  const {error:repoPulseSaveError}=await supabase.from('app_user_connections').upsert({user_id:supabaseUser.id,provider:'repopulse',external_account_id:'workspace',status:'linked',metadata:{app_url:effectiveRepoPulseUrl,links:mergedProjectLinks}},{onConflict:'user_id,provider,external_account_id'});
  if(repoPulseSaveError)throw repoPulseSaveError;
  setSupabaseMessage('Sync complete. '+mergedEvents.size+' hackathons, '+mergedDiscoveries.size+' pending discoveries, and '+mergedProjectLinks.length+' RepoPulse links available.');}catch(error){setSupabaseMessage(error instanceof Error?error.message:'Cloud sync failed. Check Supabase configuration and migration.');}finally{setSyncBusy(false);}}
  async function persistRepoPulseConnection(links:RepoPulseLink[],appUrl:string){
    if(!supabase||!supabaseUser)return;
    const {error}=await supabase.from('app_user_connections').upsert({
      user_id:supabaseUser.id,
      provider:'repopulse',
      external_account_id:'workspace',
      status:'linked',
      metadata:{app_url:appUrl,links}
    },{onConflict:'user_id,provider,external_account_id'});
    if(error)throw error;
  }
  function openRepoPulseLinkModal(event:Hackathon){
    const existing=projectLinks.find(link=>link.eventId===event.id);
    setLinkDraft({repositoryUrl:existing?.repositoryUrl||'',projectName:existing?.projectName||event.name,branch:existing?.branch||''});
    setRepoPulseMessage('');
    setLinkingEvent(event);
  }
  async function saveRepoPulseLink(e:FormEvent){
    e.preventDefault();
    if(!linkingEvent)return;
    const parsed=parseGitHubRepository(linkDraft.repositoryUrl);
    if(!parsed){setRepoPulseMessage('Paste a public GitHub repository URL in the format https://github.com/owner/repository.');return;}
    const link:RepoPulseLink={
      eventId:linkingEvent.id,
      eventName:linkingEvent.name,
      repositoryFullName:parsed.fullName,
      repositoryUrl:parsed.url,
      projectName:linkDraft.projectName.trim()||parsed.repo,
      branch:linkDraft.branch.trim(),
      linkedAt:new Date().toISOString()
    };
    const next=[...projectLinks.filter(item=>item.eventId!==linkingEvent.id),link];
    setProjectLinks(next);
    try{
      if(supabase&&supabaseUser){await persistRepoPulseConnection(next,repoPulseUrl);setRepoPulseMessage('Repository link saved to your HackTony account.');}
      else setRepoPulseMessage('Repository link saved in this browser. Sign in to HackTony cloud sync to access it on other devices.');
    }catch(error){
      setRepoPulseMessage('Saved in this browser. Cloud sync failed: '+(error instanceof Error?error.message:'unknown error'));
    }
    setLinkingEvent(null);
  }
  async function unlinkRepoPulseProject(eventId:string){
    const next=projectLinks.filter(item=>item.eventId!==eventId);
    setProjectLinks(next);
    try{await persistRepoPulseConnection(next,repoPulseUrl);}catch(error){setRepoPulseMessage(error instanceof Error?error.message:'Could not sync the unlink action.');}
    setLinkingEvent(null);
  }
  async function saveRepoPulseAppUrl(){
    const value=repoPulseUrl.trim();
    if(value){
      try{
        const parsed=new URL(value);
        if(!['https:','http:'].includes(parsed.protocol))throw new Error();
      }catch{setRepoPulseMessage('Enter a valid HTTPS app URL, or an HTTP localhost URL for local testing.');return;}
    }
    setRepoPulseUrl(value);
    try{
      if(supabase&&supabaseUser)await persistRepoPulseConnection(projectLinks,value);
      setRepoPulseMessage(value?'RepoPulse app URL saved. Deep links are enabled.':'RepoPulse app URL cleared. Repository associations remain saved.');
    }catch(error){
      setRepoPulseMessage('Saved in this browser. Cloud sync failed: '+(error instanceof Error?error.message:'unknown error'));
    }
  }
  async function signOutCloud(){if(!supabase)return;const {error}=await supabase.auth.signOut();setSupabaseMessage(error?error.message:'Signed out.');setSupabaseUser(null);}
  function saveClientId(){const clean=clientId.trim();localStorage.setItem(CLIENT_KEY,clean);setClientId(clean);setGmailMessage(clean?'Google OAuth Client ID saved on this browser.':'Client ID cleared.');}
  function loadGis():Promise<void>{return new Promise((resolve,reject)=>{const w=window as any;if(w.google?.accounts?.oauth2){resolve();return;}const existing=document.querySelector('script[data-google-gis]') as HTMLScriptElement|null;if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Google Identity script failed to load')),{once:true});return;}const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.googleGis='true';script.onload=()=>resolve();script.onerror=()=>reject(new Error('Google Identity script failed to load'));document.head.appendChild(script);});}
  async function connectGmail(){if(!clientId.trim()){setGmailMessage('First save your Google OAuth Client ID in Settings.');setPage('Settings');return;}try{await loadGis();const w=window as any;const tokenClient=w.google.accounts.oauth2.initTokenClient({client_id:clientId.trim(),scope:'https://www.googleapis.com/auth/gmail.readonly',callback:(response:any)=>{if(response.error){setGmailMessage('OAuth error: '+response.error);return;}setGmailToken(response.access_token);setGmailMessage('Gmail connected for this session.');void discoverGmail(response.access_token);}});tokenClient.requestAccessToken({prompt:'consent'});}catch(err){setGmailMessage(err instanceof Error?err.message:'Could not load Google OAuth');}}
  async function disconnectGmail(){if(gmailToken){try{await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'token='+encodeURIComponent(gmailToken)});}catch{}}setGmailToken('');setGmailMessage('Gmail disconnected. Token cleared from this session.');}
  async function discoverGmail(token:string,pageToken?:string){
    setGmailBusy(true);
    setGmailMessage(pageToken?'Scanning older matching messages…':'Scanning your Gmail history for hackathon-related messages…');
    try{
      const query='hackathon OR devpost OR unstop OR hackerearth OR devfolio OR mlh OR competition OR submission OR finalist OR winner OR "participation certificate"';
      const rows:Discovery[]=[];
      let cursor=pageToken||'';
      let pagesScanned=0;
      let messagesChecked=0;
      let hasMore=true;
      const headers={Authorization:'Bearer '+token};
      while(pagesScanned<3&&hasMore){
        const endpoint='https://gmail.googleapis.com/gmail/v1/users/me/messages?q='+encodeURIComponent(query)+'&maxResults=100'+(cursor?'&pageToken='+encodeURIComponent(cursor):'');
        const listRes=await fetch(endpoint,{headers});
        if(!listRes.ok)throw new Error('Gmail search failed ('+listRes.status+'). Check Gmail API access and try reconnecting.');
        const list=await listRes.json();
        const ids=list.messages||[];
        messagesChecked+=ids.length;
        for(let offset=0;offset<ids.length;offset+=10){
          const batch=ids.slice(offset,offset+10);
          const fetched=await Promise.all(batch.map(async(item:any)=>{
            const messageRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(item.id)+'?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date',{headers});
            if(!messageRes.ok)return null;
            const message=await messageRes.json();
            const messageHeaders=message.payload?.headers||[];
            const get=(key:string)=>messageHeaders.find((h:any)=>h.name?.toLowerCase()===key.toLowerCase())?.value||'';
            const subject=get('Subject');
            const from=get('From');
            const hay=(subject+' '+from+' '+(message.snippet||'')).toLowerCase();
            if(!/(hackathon|devpost|unstop|hackerearth|devfolio|major league hacking|\bmlh\b|competition|submission|finalist|winner|participation certificate)/.test(hay))return null;
            const platform=from.match(/@([^>\s]+)/)?.[1]||'Email';
            return {id:message.id,subject:subject||'(no subject)',from,date:get('Date'),snippet:message.snippet||'',platform,matchedAt:new Date().toISOString()} as Discovery;
          }));
          fetched.forEach((item)=>{if(item)rows.push(item);});
        }
        cursor=list.nextPageToken||'';
        hasMore=Boolean(cursor);
        pagesScanned++;
        if(!ids.length)break;
      }
      setDiscoveries(prev=>{
        const merged=new Map(prev.map(item=>[item.id,item]));
        rows.forEach(item=>merged.set(item.id,item));
        return Array.from(merged.values()).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
      });
      setGmailNextPageToken(cursor);
      setGmailMessage('Scanned '+pagesScanned+' page(s), checked '+messagesChecked+' possible messages, and found '+rows.length+' matching emails. They are grouped into '+groupDiscoveries(rows).length+' event candidates. '+(cursor?'More older messages are available to scan.':'No older matching messages remain for this search.'));
      setPage('Email discoveries');
    }catch(err){
      setGmailMessage(err instanceof Error?err.message:'Gmail history scan failed.');
    }finally{
      setGmailBusy(false);
    }
  }
  async function importDiscoveryGroup(group:DiscoveryGroup){
    const existing=events.find(event=>normalizeEventName(event.name)===group.key);
    const selectedEvidence=group.messages.slice(0,20);
    const evidence=selectedEvidence.map(message=>'['+message.date+'] '+message.subject+' — '+message.from+'\n'+message.snippet).join('\n\n')+(group.messages.length>selectedEvidence.length?'\n\n'+(group.messages.length-selectedEvidence.length)+' additional related messages were grouped.':'');
    if(existing){
      const nextStatus=STATUS_RANK[group.suggestedStatus]>STATUS_RANK[existing.status]?group.suggestedStatus:existing.status;
      setEvents(prev=>prev.map(event=>event.id===existing.id?{...event,status:nextStatus,notes:[event.notes,'Historical Gmail evidence ('+group.messages.length+' messages):',evidence].filter(Boolean).join('\n\n')}:event));
    }else{
      setEvents(prev=>[{id:crypto.randomUUID(),name:group.name,platform:group.platform,status:group.suggestedStatus,startDate:'',endDate:'',notes:'Imported from Gmail historical scan ('+group.messages.length+' related messages). Suggested status: '+group.suggestedStatus+'.\n\n'+evidence},...prev]);
    }
    const ids=group.messages.map(message=>message.id);
    setDiscoveries(prev=>prev.filter(message=>!ids.includes(message.id)));
    setGmailMessage((existing?'Updated existing tracker entry for ':'Imported ')+group.name+' using '+ids.length+' related email(s). Review the suggested status and notes.');
    if(supabase&&supabaseUser){
      const {error}=await supabase.from('hacktony_gmail_discoveries').update({status:'imported'}).eq('user_id',supabaseUser.id).in('gmail_message_id',ids);
      if(error)setSupabaseMessage(error.message);
    }
  }
  async function dismissDiscoveryGroup(group:DiscoveryGroup){
    const ids=group.messages.map(message=>message.id);
    setDiscoveries(prev=>prev.filter(message=>!ids.includes(message.id)));
    if(supabase&&supabaseUser){
      const {error}=await supabase.from('hacktony_gmail_discoveries').update({status:'dismissed'}).eq('user_id',supabaseUser.id).in('gmail_message_id',ids);
      if(error)setSupabaseMessage(error.message);
    }
  }
  async function deleteHackathon(id:string){setEvents(prev=>prev.filter(ev=>ev.id!==id));const nextLinks=projectLinks.filter(link=>link.eventId!==id);setProjectLinks(nextLinks);try{await persistRepoPulseConnection(nextLinks,repoPulseUrl);}catch(error){setRepoPulseMessage(error instanceof Error?error.message:'Could not sync removed project link.');}if(supabase&&supabaseUser){const {error}=await supabase.from('hacktony_events').delete().eq('user_id',supabaseUser.id).eq('id',id);if(error)setSupabaseMessage(error.message);}}
  async function clearAllData(){if(supabase&&supabaseUser){const [eventsDelete,discoveryDelete]=await Promise.all([supabase.from('hacktony_events').delete().eq('user_id',supabaseUser.id),supabase.from('hacktony_gmail_discoveries').delete().eq('user_id',supabaseUser.id)]);if(eventsDelete.error||discoveryDelete.error){setSupabaseMessage(eventsDelete.error?.message||discoveryDelete.error?.message||'Cloud delete failed');return;}}setEvents([]);setDiscoveries([]);setProjectLinks([]);setRepoPulseUrl('');localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(DISCOVERY_KEY);localStorage.removeItem(PROJECT_LINKS_KEY);localStorage.removeItem(REPOPULSE_URL_KEY);if(supabase&&supabaseUser){const {error}=await supabase.from('app_user_connections').delete().eq('user_id',supabaseUser.id).eq('provider','repopulse').eq('external_account_id','workspace');if(error)setSupabaseMessage(error.message);}setSupabaseMessage('Local and connected cloud data cleared.');}
  async function importFromUrl(e:FormEvent){
    e.preventDefault();
    const url=eventUrl.trim();
    if(!url)return;
    setImportBusy(true);
    setImportMessage('Reading the public event page…');
    setImportPreview(null);
    try{
      const response=await fetch('/.netlify/functions/import-hackathon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not extract event details.');
      const event=data.event;
      setImportPreview(event);
      setDraft(prev=>({
        ...prev,
        name:event.name||prev.name,
        platform:event.platform||prev.platform,
        startDate:event.startDate||prev.startDate,
        endDate:event.endDate||prev.endDate,
        submissionUrl:event.eventUrl||url,
        notes:[event.description,event.prize?'Prize: '+event.prize:'',event.location?'Location: '+event.location:'',event.sourceUrl?'Source: '+event.sourceUrl:''].filter(Boolean).join('\n\n')
      }));
      setImportMessage(event.warnings?.length?'Page details extracted. Please review the warnings and complete any missing fields below.':'Event details extracted. Review the fields below before saving.');
    }catch(error){
      setImportMessage(error instanceof Error?error.message:'Import failed. You can still enter the details manually.');
    }finally{
      setImportBusy(false);
    }
  }
  function closeModal(){setModal(false);setEventUrl('');setImportMessage('');setImportPreview(null);setDraft({name:'',platform:'Devpost',status:'Interested',startDate:'',endDate:'',submissionUrl:'',notes:''});}
  function saveEvent(e:FormEvent){
    e.preventDefault();
    if(!draft.name.trim())return;
    if(draft.submissionUrl&&events.some(event=>event.submissionUrl===draft.submissionUrl)){
      setImportMessage('This event link is already in your tracker.');
      return;
    }
    setEvents(prev=>[{...draft,id:crypto.randomUUID()},...prev]);
    closeModal();
  }
  function addFeaturedHackathon(event:FeaturedHackathon){
    const duplicate=events.some(e=>e.name.trim().toLowerCase()===event.name.trim().toLowerCase()||e.submissionUrl===event.url);
    if(duplicate)return;
    const notes=[event.location,event.prize!=='Not listed'?'Prize: '+event.prize:'',event.eligibility,event.registrationNote,'Source: '+event.sourceUrl].filter(Boolean).join('\n');
    setEvents(prev=>[{id:crypto.randomUUID(),name:event.name,platform:event.platform,status:'Interested',startDate:event.startDate,endDate:event.endDate,submissionUrl:event.url,notes},...prev]);
  }
  const heading=page==='Overview'?'Every hackathon, project, and milestone in one place.':page==='Hackathons'?'Track every event from discovery to submission.':page==='Submissions'?'Your submitted projects and submission links.':page==='Achievements'?'Celebrate milestones as your competition journey grows.':'Email discovery will become your automatic inbox importer.';
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Zap size={18} fill="currentColor"/></div><span>hack<span className="brand-tony">tony</span></span></div><div className="workspace-label">WORKSPACE</div><nav className="nav-list">{nav.map(({label,icon:Icon,count})=><button key={label} onClick={()=>setPage(label)} className={`nav-item ${page===label?'active':''}`}><Icon size={17}/><span>{label}</span>{label==='Email discoveries'&&<span className="nav-count">{groupedDiscoveries.length}</span>}</button>)}</nav><div className="sidebar-bottom"><button className="nav-item" onClick={()=>setPage('Teams')}><Users size={17}/><span>Teams</span></button><button className="nav-item" onClick={()=>setPage('Settings')}><Settings2 size={17}/><span>Settings</span></button><button className="nav-item" onClick={()=>setPage('Help & feedback')}><CircleHelp size={17}/><span>Help & feedback</span></button><div className="sidebar-user"><div className="avatar">R</div><div><strong>Your workspace</strong><small>Personal account</small></div><ChevronDown size={15}/></div></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>{page}</strong></div><div className="top-actions"><button className="icon-button" onClick={()=>{setPage('Hackathons');setTimeout(()=>document.getElementById('hack-search')?.focus(),0)}} aria-label="Search hackathons"><Search size={17}/></button><button className="help-button" onClick={()=>setPage('Help & feedback')}><CircleHelp size={16}/> Help</button><div className="avatar small">R</div></div></header><div className="content"><div className="page-heading"><div><p className="eyebrow">YOUR COMPETITION JOURNEY</p><h1>{page}</h1><p className="subtitle">{heading}</p></div><button className="primary-button" onClick={()=>setModal(true)}><Plus size={17}/> Add hackathon</button></div>
{page==='Overview'&&<><HackathonDiscovery trackedEvents={events} onAdd={addFeaturedHackathon}/><section className="stats-grid">{stats.map(({label,value,note,icon:Icon})=><article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={17}/></div></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>)}</section><section className="main-grid"><article className="panel journey-panel"><div className="panel-header"><div><h2>Your journey</h2><p>Hackathon activity over time</p></div><button className="select-button" onClick={()=>setTimePeriod(p=>p==='All time'?'This year':p==='This year'?'This month':'All time')}>{timePeriod} <ChevronDown size={14}/></button></div>{visibleEvents.length?<div className="journey-list">{visibleEvents.slice(0,5).map(e=><div className="journey-row" key={e.id}><span className="journey-dot"/><div><strong>{e.name}</strong><small>{e.platform} · {e.status}</small></div><span className="journey-date">{e.startDate||'Date not set'}</span></div>)}</div>:<div className="empty-chart"><div className="chart-grid"><span/><span/><span/><span/></div><div className="chart-empty-icon"><Activity size={22}/></div><strong>Your activity will appear here</strong><p>Add a hackathon to start tracking your journey.</p></div>}</article><article className="panel sync-panel"><div className="panel-header"><div><h2>Email discovery</h2><p>Gmail-powered activity import</p></div><div className={`status-pill ${gmailToken?'connected':''}`}><span/> {gmailToken?'Connected this session':'Not connected'}</div></div><div className="gmail-card"><div className="gmail-logo">G</div><div><strong>Connect your Gmail</strong><p>Read-only access. Your inbox stays untouched.</p></div></div><button className="connect-button" onClick={()=>void connectGmail()}>{gmailToken?'Refresh Gmail discovery':'Connect Gmail & discover'} <ChevronDown size={15}/></button><div className="sync-footnote"><span className="lock-dot"/> Privacy-first · Read-only · No scraping</div></article></section></>}
{page==='Hackathons'&&<section className="panel recent-panel"><div className="panel-header"><div><h2>All hackathons</h2><p>{events.length} tracked event{events.length===1?'':'s'}</p></div><div className="search-box"><Search size={15}/><input id="hack-search" placeholder="Search hackathons..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>{repoPulseMessage&&<div className="integration-message">{repoPulseMessage}</div>}{filtered.length?<div className="event-list">{filtered.map(e=>{const repoLink=projectLinks.find(link=>link.eventId===e.id);const deepLink=repoLink?buildRepoPulseDeepLink(repoPulseUrl,repoLink):'';return <article className="event-card" key={e.id}><div className="event-icon"><CalendarDays size={18}/></div><div className="event-info"><strong>{e.name}</strong><p>{e.platform} · {e.startDate||'Date TBD'}{e.endDate?' – '+e.endDate:''}</p>{e.notes&&<small>{e.notes}</small>}</div><div className="repopulse-event-link">{repoLink?<><span title={repoLink.repositoryFullName}><Link2 size={13}/>{repoLink.repositoryFullName}</span>{deepLink?<a href={deepLink} target="_blank" rel="noreferrer">Open RepoPulse</a>:<button type="button" onClick={()=>setPage('Settings')}>Set app URL</button>}<button type="button" className="relink-button" onClick={()=>openRepoPulseLinkModal(e)}>Edit</button></>:<button type="button" onClick={()=>openRepoPulseLinkModal(e)}><Link2 size={13}/> Link project</button>}</div><select value={e.status} onChange={x=>setEvents(prev=>prev.map(ev=>ev.id===e.id?{...ev,status:x.target.value as Hackathon['status']}:ev))} className="status-select">{['Interested','Registered','In progress','Submitted','Completed'].map(s=><option key={s}>{s}</option>)}</select><button className="delete-event" title="Remove" onClick={()=>void deleteHackathon(e.id)}><X size={16}/></button></article>})}</div>:<div className="empty-table"><div className="empty-inbox"><Inbox size={20}/></div><strong>{search?'No matching hackathons':'No hackathons yet'}</strong><p>{search?'Try a different search.':'Add your first event to start building your history.'}</p><button className="secondary-button" onClick={()=>setModal(true)}><Plus size={15}/> Add your first hackathon</button></div>}</section>}
{page==='Submissions'&&<section className="panel recent-panel"><div className="panel-header"><div><h2>Submissions</h2><p>Projects you have submitted</p></div></div>{events.filter(e=>e.status==='Submitted'||e.status==='Completed').length?events.filter(e=>e.status==='Submitted'||e.status==='Completed').map(e=><article className="event-card" key={e.id}><div className="event-icon"><Upload size={18}/></div><div className="event-info"><strong>{e.name}</strong><p>{e.platform} · {e.status}</p>{e.submissionUrl&&<a href={e.submissionUrl} target="_blank" rel="noreferrer">Open submission</a>}</div></article>):<div className="empty-table"><div className="empty-inbox"><Upload size={20}/></div><strong>No submissions tracked</strong><p>Update a hackathon's status to Submitted to see it here.</p></div>}</section>}
{page==='Achievements'&&<section className="panel recent-panel"><div className="panel-header"><div><h2>Achievements</h2><p>Milestones in your journey</p></div></div><div className="achievement-grid"><article><Award/><strong>First hackathon</strong><p>{events.length?'Unlocked — you added your first event':'Add a hackathon to unlock'}</p></article><article><Trophy/><strong>First submission</strong><p>{submitted?'Unlocked — you tracked a submission':'Track a submission to unlock'}</p></article><article><CheckCircle2/><strong>5 hackathons</strong><p>{events.length>=5?'Unlocked — 5 events tracked':events.length+' / 5 events tracked'}</p></article></div></section>}
{page==='Email discoveries'&&<section className="panel recent-panel"><div className="panel-header"><div><h2>Historical email discoveries</h2><p>Gmail read-only scan · {groupedDiscoveries.length} candidate events from {discoveries.length} matching emails</p></div><div className="discovery-header-actions"><button className="primary-button" disabled={gmailBusy} onClick={()=>void (gmailToken?discoverGmail(gmailToken):connectGmail())}>{gmailBusy?'Scanning…':gmailToken?'Scan Gmail history':'Connect Gmail'}</button>{gmailToken&&gmailNextPageToken&&<button className="secondary-button" disabled={gmailBusy} onClick={()=>void discoverGmail(gmailToken,gmailNextPageToken)}>{gmailBusy?'Scanning…':'Scan older emails'}</button>}</div></div>{gmailMessage&&<div className="integration-message">{gmailMessage}</div>}{groupedDiscoveries.length? <div className="discovery-list">{groupedDiscoveries.map(group=><article className="discovery-card" key={group.key}><div className="discovery-icon"><Mail size={17}/></div><div className="discovery-body"><strong>{group.name}</strong><small>{group.platform} · {group.messages.length} related email(s){group.latestDate?' · latest '+group.latestDate:''}</small><p><b>Suggested status: {group.suggestedStatus}</b><br/>{group.messages.slice(0,3).map(message=>message.subject).join(' · ')}{group.messages.length>3?' · +'+(group.messages.length-3)+' more':''}</p></div><div className="discovery-actions"><button className="secondary-button" onClick={()=>void importDiscoveryGroup(group)}>Import event</button><button className="delete-event" onClick={()=>void dismissDiscoveryGroup(group)} title="Dismiss this event and its related emails"><X size={16}/></button></div></article>)}</div>:<div className="empty-table"><div className="empty-inbox"><Mail size={20}/></div><strong>No event candidates yet</strong><p>Connect Gmail with read-only permission, then scan your inbox history. Related registration, submission, finalist, and winner emails are grouped into event candidates for review.</p><button className="secondary-button" disabled={gmailBusy} onClick={()=>void connectGmail()}>{gmailBusy?'Scanning…':'Connect Gmail & scan history'}</button></div>}{gmailToken&&gmailNextPageToken&&<div className="discovery-pagination"><span>More older matching emails are available.</span><button className="secondary-button" disabled={gmailBusy} onClick={()=>void discoverGmail(gmailToken,gmailNextPageToken)}>Scan older messages</button></div>}</section>}{page==='Settings'&&<section className="panel settings-panel"><div className="panel-header"><div><h2>Integrations & settings</h2><p>Configure Gmail OAuth for this browser</p></div></div><div className="settings-block"><h3>Cloud sync & account</h3>{!supabase?<><p>Cloud sync is not configured on this deployment. Add these public build variables in Netlify: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</p></>:supabaseUser?<><p>Signed in as <strong>{supabaseUser.email}</strong></p><div className="settings-actions"><button className="primary-button" disabled={syncBusy} onClick={()=>void syncCloud()}>{syncBusy?'Syncing…':'Sync now'}</button><button className="secondary-button" onClick={()=>void signOutCloud()}>Sign out</button></div></>:<><label>Sign in with email<input type="email" value={supabaseEmail} onChange={e=>setSupabaseEmail(e.target.value)} placeholder="you@example.com"/></label><div className="settings-actions"><button className="primary-button" onClick={()=>void sendMagicLink()}>Send magic link</button></div><p>Magic-link authentication; no password required.</p></>}{supabaseMessage&&<div className="integration-message">{supabaseMessage}</div>}</div><div className="settings-block"><label>Google OAuth Client ID<input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="123456789-abc.apps.googleusercontent.com"/></label><p>Used for Google Identity Services in the browser. Create a Web OAuth client in Google Cloud, enable Gmail API, and add this site's origin to Authorized JavaScript origins. The app requests Gmail read-only access only.</p><div className="settings-actions"><button className="primary-button" onClick={saveClientId}>Save Client ID</button><button className="secondary-button" onClick={()=>void connectGmail()}>Connect Gmail</button><button className="secondary-button" onClick={()=>void disconnectGmail()}>Disconnect</button></div>{gmailMessage&&<div className="integration-message">{gmailMessage}</div>}</div><div className="settings-block"><h3>RepoPulse integration</h3><p>Keep RepoPulse deployed separately. Enter its app URL to enable direct project links; HackTony stores only repository references and does not share GitHub tokens.</p><label>RepoPulse app URL<input type="url" value={repoPulseUrl} onChange={e=>setRepoPulseUrl(e.target.value)} placeholder="https://your-repopulse-site.example"/></label><div className="settings-actions"><button className="primary-button" onClick={()=>void saveRepoPulseAppUrl()}>Save RepoPulse URL</button></div>{repoPulseMessage&&<div className="integration-message">{repoPulseMessage}</div>}<p>{projectLinks.length} hackathon project link{projectLinks.length===1?'':'s'} saved. Repo links are stored with your HackTony account when cloud sync is connected.</p></div><div className="settings-block"><h3>Data controls</h3><p>Hackathon records, Gmail discoveries, and RepoPulse project links are stored locally and can be synced to your signed-in HackTony account.</p><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify({events,discoveries,projectLinks,repoPulseUrl},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hacktony-export.json';a.click();URL.revokeObjectURL(url);}}>Export my data (JSON)</button><button className="secondary-button danger-button" onClick={()=>{if(confirm('Delete all HackTony events and discoveries from this browser and connected cloud account?')){void clearAllData();}}}>Delete local data</button></div></section>}
{page==='Teams'&&<section className="panel recent-panel"><div className="panel-header"><div><h2>Teams</h2><p>Team support is not connected to a database yet.</p></div></div><div className="empty-table"><div className="empty-inbox"><Users size={20}/></div><strong>Personal workspace</strong><p>Team collaboration requires account and database sync. For now, add team names in hackathon notes.</p></div></section>}
{page==='Help & feedback'&&<section className="panel recent-panel"><div className="panel-header"><div><h2>Help & feedback</h2><p>Quick setup and current limitations</p></div></div><div className="help-content"><h3>Connect Gmail</h3><ol><li>Open Google Cloud Console and create/select a project.</li><li>Enable Gmail API.</li><li>Configure OAuth consent screen and add your Google account as a test user (while in testing mode).</li><li>Create a Web application OAuth Client ID and add <code>https://hacktony.netlify.app</code> to Authorized JavaScript origins.</li><li>Copy the Client ID into HackTony Settings and press Connect Gmail.</li></ol><h3>What permissions does HackTony request?</h3><p>Gmail read-only. It cannot send, delete, or modify messages. Discovery results are reviewed before being added to your tracker.</p><h3>Current status</h3><p>Manual tracker and Gmail discovery UI are implemented. Cross-device database sync is next; the existing Hack Tony Supabase project is currently paused.</p></div></section>}
{!['Overview','Hackathons','Submissions','Achievements','Email discoveries','Settings','Teams','Help & feedback'].includes(page)&&<section className="panel recent-panel"><div className="empty-table"><strong>{page}</strong><p>This area is planned. The core hackathon tracker is being built first.</p></div></section>}
<footer>HackTony <span>·</span> Built for your hackathon journey <span>·</span> Zero-cost-first architecture</footer></div></main>
{modal&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)closeModal()}}><div className="modal-card"><div className="modal-head"><div><h2>Add hackathon</h2><p>Paste an event link to prefill details, or enter them manually.</p></div><button className="modal-close" onClick={closeModal}><X size={18}/></button></div><form className="link-import-form" onSubmit={importFromUrl}><label>Hackathon event URL<input type="url" required value={eventUrl} onChange={e=>setEventUrl(e.target.value)} placeholder="https://devpost.com/hackathons/..."/></label><button type="submit" className="primary-button" disabled={importBusy}>{importBusy?'Extracting details…':<><Link2 size={15}/> Extract event details</>}</button></form>{importMessage&&<div className="import-message">{importMessage}</div>}{importPreview&&<div className="import-preview"><strong>{importPreview.name}</strong><span>{[importPreview.platform,importPreview.startDate,importPreview.endDate].filter(Boolean).join(' · ')}</span>{importPreview.warnings?.length>0&&<small>{importPreview.warnings.join(' ')}</small>}<p>Auto-filled fields are editable. Check the event page for anything that could not be extracted.</p></div>}<div className="manual-entry-divider"><span>OR REVIEW / ENTER DETAILS MANUALLY</span></div><form onSubmit={saveEvent}><label>Hackathon name *<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="e.g. HackMIT"/></label><div className="form-row"><label>Platform<input value={draft.platform} onChange={e=>setDraft({...draft,platform:e.target.value})} placeholder="Devpost, Unstop..."/></label><label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Hackathon['status']})}>{['Interested','Registered','In progress','Submitted','Completed'].map(s=><option key={s}>{s}</option>)}</select></label></div><div className="form-row"><label>Start date<input type="date" value={draft.startDate} onChange={e=>setDraft({...draft,startDate:e.target.value})}/></label><label>End date<input type="date" value={draft.endDate} onChange={e=>setDraft({...draft,endDate:e.target.value})}/></label></div><label>Event / registration URL<input type="url" value={draft.submissionUrl} onChange={e=>setDraft({...draft,submissionUrl:e.target.value})} placeholder="Event or registration page URL"/></label><label>Notes<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Team, idea, deadline, details..." rows={3}/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button type="submit" className="primary-button">Save hackathon</button></div></form></div></div>}
{linkingEvent&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setLinkingEvent(null)}}><div className="modal-card"><div className="modal-head"><div><h2>Link a RepoPulse project</h2><p>{linkingEvent.name}</p></div><button className="modal-close" onClick={()=>setLinkingEvent(null)}><X size={18}/></button></div><form onSubmit={saveRepoPulseLink}><label>Public GitHub repository URL *<input required type="url" value={linkDraft.repositoryUrl} onChange={e=>setLinkDraft({...linkDraft,repositoryUrl:e.target.value})} placeholder="https://github.com/owner/repository"/></label><label>Project display name<input value={linkDraft.projectName} onChange={e=>setLinkDraft({...linkDraft,projectName:e.target.value})} placeholder="Project name"/></label><label>Branch override (optional)<input value={linkDraft.branch} onChange={e=>setLinkDraft({...linkDraft,branch:e.target.value})} placeholder="Leave blank to use GitHub default"/></label><div className="repo-link-info">RepoPulse currently reads public GitHub repositories only. You must connect GitHub separately inside RepoPulse. No access token is copied to HackTony.</div>{repoPulseMessage&&<div className="integration-message">{repoPulseMessage}</div>}<div className="modal-actions">{projectLinks.some(link=>link.eventId===linkingEvent.id)&&<button type="button" className="secondary-button danger-button" onClick={()=>void unlinkRepoPulseProject(linkingEvent.id)}>Unlink project</button>}<button type="button" className="secondary-button" onClick={()=>setLinkingEvent(null)}>Cancel</button><button type="submit" className="primary-button">Save project link</button></div></form></div></div>}
</div>
}
