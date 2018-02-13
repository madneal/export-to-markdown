import os
import shutil
import zipfile
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

if __name__ == '__main__':
  if os.path.isdir(zip_dir):
    shutil.rmtree(zip_dir)
  os.remove(zip_filename)
  create_dir()
  move_files()
  zip()