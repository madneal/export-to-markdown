import os
import shutil
import zipfile
import json

zip_dir = 'export-to-markdown'
zip_filename = zip_dir + '.zip'

def create_dir():
  os.makedirs(zip_dir)

def move_files():
  shutil.copytree('icons', zip_dir + '/icons')
  shutil.copytree('scripts', zip_dir + '/scripts')
  shutil.copyfile('manifest.json', zip_dir + '/manifest.json')
  shutil.copyfile('popup.html', zip_dir + '/popup.html')
  shutil.copyfile('load.svg', zip_dir + '/load.svg')
  os.remove(zip_dir + '/scripts/turndown.js')


def zip():
  zipf = zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED)
  for root, dirs, files in os.walk(zip_dir):
    for file in files:
      print(root + ':' + file)
      zipf.write(os.path.join(root, file))

def modify_version():
  with open(zip_dir + '/manifest.json', 'r') as f:
    manifest = json.load(f)
  version = manifest['version']
  version = version.replace('.', '')
  version = int(version)
  version = version + 1
  version = str(version)
  version = '.'.join(version)
  if len(version) < 4:
    version = '0.' + version
  manifest['version'] = version
  with open(zip_dir + '/manifest.json', 'w') as f:
    json.dump(manifest, f) 

if __name__ == '__main__':
  if os.path.isdir(zip_dir):
    shutil.rmtree(zip_dir)
  if os.path.exists(zip_filename):
    os.remove(zip_filename)
  create_dir()
  move_files()
  modify_version()
  zip()