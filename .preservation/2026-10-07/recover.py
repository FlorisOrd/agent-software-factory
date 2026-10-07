#!/usr/bin/env python3
"""Recover this reviewed preservation payload into a NEW directory. Requires Git."""
from pathlib import Path, PurePosixPath
import argparse, json, hashlib, subprocess, zipfile, shutil
def digest(b): return hashlib.sha256(b).hexdigest()
def git(p,*a,data=None):
 r=subprocess.run(['git','-c','safe.directory='+str(p),'-C',str(p),*a],input=data,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr.decode('utf-8','replace'))
 return r.stdout.decode('utf-8','replace')
def contained(root,name):
 p=PurePosixPath(name)
 if p.is_absolute() or '..' in p.parts: raise ValueError('Unsafe archive path')
 target=root.joinpath(*p.parts)
 if not target.resolve().is_relative_to(root.resolve()): raise ValueError('Escaping archive path')
 return target
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
 payload=Path(__file__).resolve().parent;out=args.output.resolve()
 if out.exists():raise SystemExit('Output must not exist; nothing overwritten')
 manifest=json.loads((payload/'MANIFEST.json').read_text())
 for f in manifest['payload_files']:
  b=contained(payload,f['relative']).read_bytes()
  if len(b)!=f['bytes'] or digest(b)!=f['sha256']:raise RuntimeError('Payload mismatch: '+f['relative'])
 out.mkdir(parents=True);ws=out/'workspaces';ws.mkdir()
 files=json.loads((payload/'files.json').read_text())
 with zipfile.ZipFile(payload/'working-files.zip') as z:
  for f in files:
   b=z.read(f['archive'])
   if len(b)!=f['length'] or digest(b)!=f['sha256']:raise RuntimeError('Original file mismatch')
   p=contained(ws,f['archive']);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 base=manifest['source_base'].replace('\\','/').rstrip('/')+'/'
 count=0
 for rp in sorted((payload/'git').glob('r[0-9][0-9][0-9].json')):
  r=json.loads(rp.read_text());bare=out/'git-archives'/(r['id']+'.git');bare.parent.mkdir(exist_ok=True)
  git(out,'init','--bare',str(bare));pack=(payload/'git'/r['pack']).read_bytes()
  if digest(pack)!=r['pack_sha256']:raise RuntimeError('Pack mismatch')
  git(bare,'index-pack','--stdin',data=pack)
  actual={x.split()[0]:(x.split()[1],int(x.split()[2])) for x in git(bare,'cat-file','--batch-all-objects','--batch-check=%(objectname) %(objecttype) %(objectsize)').splitlines()}
  expected={x['oid']:(x['type'],x['size']) for x in r['objects']}
  if actual!=expected:raise RuntimeError('Object inventory mismatch')
  for line in r['refs']['output']:
   name,kind,oid=line.split();git(bare,'update-ref',name,oid)
  for name,target in r.get('symbolic_refs',{}).items():git(bare,'symbolic-ref',name,target)
  meta=out/'git-metadata'/r['id'];meta.mkdir(parents=True)
  mz=payload/'git'/(r['id']+'-metadata.zip')
  if digest(mz.read_bytes())!=r['metadata_sha256']:raise RuntimeError('Metadata archive mismatch')
  with zipfile.ZipFile(mz) as z:
   for f in r['metadata_files']:
    b=z.read(f['path'])
    if digest(b)!=f['sha256']:raise RuntimeError('Metadata member mismatch')
    dest=contained(meta,f['path']);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b)
  if (meta/'HEAD').exists():(bare/'HEAD').write_bytes((meta/'HEAD').read_bytes())
  original=r['root'].replace('\\','/')
  if not original.startswith(base):raise RuntimeError('Unrecognized source root')
  workspace=contained(ws,original[len(base):])
  is_bare=r.get('safe_local_config',{}).get('core.bare')=='true'
  gd=workspace if is_bare else workspace/'.git'
  if gd.exists():raise RuntimeError('Refusing existing restored Git directory')
  gd.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(bare,gd)
  if not is_bare:
   git(workspace,'config','core.bare','false')
   for key,value in r.get('safe_local_config',{}).items():
    if key!='core.bare':git(workspace,'config',key,value)
   if (meta/'index').exists():(gd/'index').write_bytes((meta/'index').read_bytes())
  count+=1
 print(json.dumps({'result':'PASS','material_files':len(files),'repositories':count,'output':str(out),'notes':'Original configs/credentials are excluded. Logs and custom hooks remain reviewable in git-metadata; hooks are not activated. See README.md.'}))
if __name__=='__main__':main()
