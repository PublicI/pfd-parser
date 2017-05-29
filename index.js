// jshint esnext:true
// Started as a PDF.js example file, originally licensed public domain

const _ = require('highland'),
    vfs = require('vinyl-fs'),
    Filing = require('./lib/filing');

const filingsPath = `${__dirname}/test/data/`; // make these configurable
    dataPath = `${__dirname}/test/data/`;

let skipHeaders = {}; // hmmm

function processFilings(path) {
    // process all PDFs in the directory
    _(vfs.src(path + '**/*.@(pdf|PDF)'))
        .map((file) => new Filing(file))
        .flatMap((filing) => {
            return _(filing.process())
        })
        .flatMap((filing) => {
            filing.skipHeaders = skipHeaders; // hmmmmmmm

            return _(filing.save(dataPath))
        })
        .each((filing) => console.log(filing.file.relative,filing.count))
        .done(() => console.log('done'));
}

processFilings(filingsPath);
