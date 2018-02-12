const fs = require('fs')
const zipDir = 'export-to-markdown'

gulp.task('createDir', function() {
  fs.mkdirSync(zipDir, 0755)
  fs.mkdirSync(zipDir + '/icons', 0755)
  fs.mkdirSync(zipDir + '/scripts', 0755)
})