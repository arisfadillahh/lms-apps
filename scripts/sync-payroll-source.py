#!/usr/bin/env python3
"""Read the migration source in place; update only the single LMS payroll ledger."""
import argparse, datetime, fcntl, gzip, json, os, pathlib, sqlite3, subprocess, sys

parser=argparse.ArgumentParser()
parser.add_argument('--config',required=True); parser.add_argument('--env'); parser.add_argument('--period'); parser.add_argument('--actor'); parser.add_argument('--apply',action='store_true'); parser.add_argument('--install-config',action='store_true')
args=parser.parse_args()
if args.install_config:
    config=json.load(sys.stdin)
    assert set(config)=={'credential_id','spreadsheet_id','container','database','until_period','backup_dir'}
    os.umask(0o077)
    with open(args.config,'x') as handle: json.dump(config,handle)
    print(json.dumps({'configured':True}));sys.exit(0)
config=json.load(open(args.config))
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
year,month=now.year,now.month
if now.day>=26: month+=1
if month==13: year+=1;month=1
period=f'{year:04d}-{month:02d}'
if args.period and args.period!=period: raise SystemExit('Only the current payroll period can refresh the migration source.')
if period>config['until_period']:
    print(json.dumps({'skipped':'Migration source period ended'}));sys.exit(0)
if not args.env: raise SystemExit('--env is required')
lock=open(str(pathlib.Path(args.config).with_suffix('.lock')),'a')
try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError: raise SystemExit('A payroll refresh is already running. Try again shortly.')
db=sqlite3.connect('file:'+config['database']+'?mode=ro',uri=True)
row=db.execute('SELECT data FROM credentials_entity WHERE id=?',(config['credential_id'],)).fetchone();db.close()
if not row: raise SystemExit('Read-only source connection unavailable.')
script=r'''
const fs=require('fs'),path=require('path');
const {Cipher}=require(path.join(path.dirname(require.resolve('n8n-core')),'encryption/cipher.js'));
(async()=>{
 const config=JSON.parse(fs.readFileSync('/home/node/.n8n/config','utf8'));
 const credential=JSON.parse(new Cipher({encryptionKey:process.env.N8N_ENCRYPTION_KEY||config.encryptionKey}).decrypt(fs.readFileSync(0,'utf8')));
 let token=credential.oauthTokenData.access_token;
 async function get(url){
  let response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  if(response.status===401){
   const refreshed=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:credential.oauthTokenData.refresh_token,client_id:credential.clientId,client_secret:credential.clientSecret}),signal:AbortSignal.timeout(20000)});
   if(!refreshed.ok)throw Error('Source authorization failed: HTTP '+refreshed.status);
   token=(await refreshed.json()).access_token;response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  }
  if(!response.ok)throw Error('Source read failed: HTTP '+response.status);return response.json();
 }
 const id=process.argv[1];
 const file=await get('https://www.googleapis.com/drive/v3/files/'+id+'?fields=id,name,mimeType,createdTime,modifiedTime');
 if(file.mimeType!=='application/vnd.google-apps.spreadsheet')throw Error('Unexpected source file type');
 const query=new URLSearchParams({includeGridData:'true',ranges:"'ID Coaches'!A1:AL60",fields:'spreadsheetId,sheets(properties,data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue))))'});
 const cells=await get('https://sheets.googleapis.com/v4/spreadsheets/'+id+'?'+query);
 const tail=await get('https://sheets.googleapis.com/v4/spreadsheets/'+id+'/values/'+encodeURIComponent("'ID Coaches'!A61:C"));
 if(tail.values?.some(row=>row.some(Boolean)))throw Error('New identities found below supported source range');
 console.log(JSON.stringify({snapshots:[{file,capturedAt:new Date().toISOString(),cells}]}));
})().catch(e=>{console.error(e.message);process.exit(1)});
'''
result=subprocess.run(['docker','exec','-i','-w','/usr/local/lib/node_modules/n8n',config['container'],'node','-e',script,config['spreadsheet_id']],input=row[0],capture_output=True,text=True,timeout=80)
if result.returncode: raise SystemExit(result.stderr.strip()[-400:])
bundle=json.loads(result.stdout)
if not args.apply:
    print(json.dumps({'mode':'DRY_RUN','period':period,'sourceModifiedAt':bundle['snapshots'][0]['file']['modifiedTime']}));sys.exit(0)
os.umask(0o077)
backup=pathlib.Path(config['backup_dir'])/now.strftime('%Y-%m-%dT%H-%M-%S-%f')
backup.mkdir(parents=True,mode=0o700)
source=backup/'source.json.gz'
with gzip.open(source,'wt') as handle:json.dump(bundle,handle)
root=pathlib.Path(__file__).resolve().parent
commands=[['node',str(root/'import-payroll-legacy.mjs'),'--input',str(source),'--current-period',period,'--ignore-unlabelled-extras','--apply','--env',args.env,'--backup-dir',str(backup/'import')],['node',str(root/'unify-payroll-periods.mjs'),'--period',period,'--apply','--env',args.env,'--backup-dir',str(backup/'ledger')]]
if args.actor:commands[-1].extend(['--actor',args.actor])
for command in commands:
    result=subprocess.run(command,capture_output=True,text=True,timeout=60)
    if result.returncode:raise SystemExit('Payroll refresh stopped; previous records retained. '+result.stderr.strip()[-350:])
print(json.dumps({'synced':True,'period':period,'backupDir':str(backup),'automationEnabled':False}))
