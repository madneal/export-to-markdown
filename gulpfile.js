const fs = require('fs')
const gulp = require('gulp')
const del = require('del')
const zip = require('gulp-zip')
const archiver = require('archiver')
const runSequence = require('run-sequence')
const zipDir = 'export-to-markdown'

// gulp.task('createDir', function() {
//   // if (fs.existsSync(zipDir)) {
//   //   del(zipDir)
//   // }
//   // if (fs.existsSync(zipDir + '.zip')) {
//   //   del(zipDir + '.zip')
//   // }
//   fs.mkdirSync(zipDir, 0755)
//   fs.mkdirSync(zipDir + '/icons', 0755)
//   fs.mkdirSync(zipDir + '/scripts', 0755)
// })

gulp.task('moveFile', function() {
  gulp.src('icons/*.png')
    .pipe(gulp.dest(zipDir + '/icons'))
  gulp.src('scripts/*.js')
    .pipe(gulp.dest(zipDir + '/scripts'))
  del(zipDir + '/scripts/turndown.js')
  gulp.src(['load.svg', 'manifest.json', 'popup.html'])
    .pipe(gulp.dest(zipDir + '/'))
})

gulp.task('clear', function() {
  del(zipDir)
  del('export-to-markdown.zip')
})

gulp.task('zip', function() {
  return gulp.src(zipDir + '/*')
    .pipe(zip(zipDir + '.zip'))
    .pipe(gulp.dest('./'))
})

gulp.task('chrome', function (callback) {
  runSequence('clear', 'moveFile', callback);
});