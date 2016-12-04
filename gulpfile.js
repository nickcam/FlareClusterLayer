
var gulp = require('gulp');
var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

//Task to copy dojo tpyings from node modules to typings folder. dojo typings don't work using typings tool - so we install them using npm then just copy them over from there.
//manually copy teh reference to the dojo modules *.d.ts files in the typings index file.
gulp.task('copy-dojo-typings', function () {
    return gulp.src([
      'node_modules/dojo-typings/dojo/**/*.ts',
      'node_modules/dojo-typings/dojox/**/*.ts',
      'node_modules/dojo-typings/dijit/**/*.ts',
      'node_modules/dojo-typings/doh/**/*.ts',
    ],
    { base: './node_modules/dojo-typings/' }
    ).pipe(gulp.dest('typings/globals/dojo'));
});

gulp.task('typescript-compile', function () {
    return tsProject.src()
        .pipe(ts(tsProject))
        .js.pipe(gulp.dest(tsProject.options.outDir));
});

//watch for changes on ts files and compile and copy when saved
gulp.task('watch', function () {
    return gulp.watch('typescript/**/*.ts', ['typescript-compile']); //watch typescript files to compile.
});

gulp.task('default', ["typescript-compile", "watch", "copy-dojo-typings"]);
