// jshint esnext:true
// Started as a PDF.js example file, originally licensed public domain

const _ = require('highland'),
    vfs = require('vinyl-fs'),
    parser = require('./lib/parser');

function processFilings(filingsPath,dataPath) {
    // process all PDFs in the directory
    _(vfs.src(filingsPath + '**/*.@(pdf|PDF)'))
        .flatMap((file) => {
            console.log(file.relative);

            return _(parser(file));
        })
        .flatMap((filing) => _(filing.save(dataPath)))
        .done(() => console.log('done'));
}

module.exports = processFilings;
