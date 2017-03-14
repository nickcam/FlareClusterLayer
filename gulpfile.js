
var gulp = require('gulp');
var ts = require("gulp-typescript");
var sourcemaps = require('gulp-sourcemaps');

var tsProject = ts.createProject("tsconfig.json");

//typescript compile task
gulp.task('typescript-compile', function () {

    var tsResult = tsProject.src()
       .pipe(sourcemaps.init())
       .pipe(tsProject());

    return tsResult.js
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(tsProject.options.outDir));

     
});

//watch for changes on ts files and compile and copy when saved
gulp.task('watch', function () {
    return gulp.watch('typescript/**/*.ts', ['typescript-compile']); //watch typescript files to compile.
});

gulp.task('default', ["typescript-compile", "watch"]);
