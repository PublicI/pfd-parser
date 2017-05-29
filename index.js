// jshint esnext:true
// Started as a PDF.js example file, originally licensed public domain

const _ = require('highland'),
    dsv = require('d3-dsv'),
    fs = require('fs'),
    vfs = require('vinyl-fs');

global.DOMParser = require('./lib/domparsermock.js').DOMParserMock;

var pdfjs = require('pdfjs-dist');

const filingsPath = `${__dirname}/test/data/`; // make these configurable
    dataPath = `${__dirname}/test/data/`;

let skipHeaders = {}; // hmmm

function getBoldFont(content) {
    let boldFont = '';

    const styleKeys = Object.keys(content.styles);
    styleKeys.forEach(styleKey => {
        if (content.styles[styleKey].fontFamily == 'sans-serif' &&
            content.styles[styleKey].descent < -0.295) { // can we use a better metric than this?
            boldFont = styleKey;
        }
    });

    return boldFont;
}

function saveFiling(file, tables) {
    const fileName = file.basename
        .replace('.pdf', '')
        .replace('.PDF', '');

    let count = 0;

    return new Promise((resolve, reject) => {
        tables.forEach(table => {
            const csvFile = `${dataPath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`;

            table.rows.forEach(row => {
                row.file = fileName;
            });

            if (table.cols.length > 0) {
                const columns = ['file'].concat(table.cols.map(col => col.slug));
                let csvString = dsv.csvFormat(table.rows, columns);

                if (skipHeaders[table.name]) {
                    csvString = csvString.substring(csvString.indexOf('\n') + 1);
                }
                else {
                    skipHeaders[table.name] = true;
                }

                fs.appendFileSync(csvFile, `${csvString}\n`);

                count += table.rows.length;
            }
        });

        resolve({
            count: count,
            file: file
        });
    });
}

function processFiling(file) {
    let tables = [];
    let ignoreRest = false;

    function processPage(page) {
        const viewport = page.getViewport(1.0); // scale

        return page.getTextContent()
            .then(content => {
                return new Promise((resolve, reject) => {
                    let boldFont = getBoldFont(content);
                    let ignorePage = false;
                    let rowY = 0;

                    content.items.sort((a, b) => {
                        if (a.transform[4] - b.transform[4] !== 0) {
                            return a.transform[4] - b.transform[4];
                        } else {
                            return a.transform[5] - b.transform[5];
                        }
                    }).forEach((item, i) => {
                        if (item.str.includes('Data Revised') ||
                            item.str === 'U.S. Office of Government Ethics Certification') {
                            ignorePage = true;
                        }

                        if (!ignorePage && !ignoreRest) {
                            if (item.height == 14) {
                                if (item.str == 'Filer\'s Information') {
                                    ignorePage = true;
                                } else if (item.str == 'Summary of Contents') {
                                    ignoreRest = true;
                                } else if (item.str.trim().length > 2) {
                                    const headerParts = item.str.split('. ');
                                    let part = null;
                                    let name = null;

                                    if (headerParts.length > 1) {
                                        part = parseInt(headerParts[0]);
                                        name = headerParts.slice(1).join('. ');
                                    } else {
                                        name = item.str;
                                    }

                                    tables.push({
                                        part,
                                        name,
                                        cols: [],
                                        rows: []
                                    });
                                }
                            } else if (item.height == 10) {
                                const curTable = tables[tables.length - 1];
                                if (curTable) {

                                    if (item.fontName == boldFont) {
                                        if (item.str == 'PART' || (item.str == '#' && curTable.cols.length > 1)) {
                                            curTable.cols = [];
                                        }

                                        let append = true;

                                        curTable.cols.forEach(col => {
                                            if (col.x == item.transform[5]) {
                                                col.name += ` ${item.str}`;
                                                col.slug = col.name.toLowerCase().replace(/[ ,]+/g, '-');
                                                append = false;
                                            }
                                        });

                                        if (append) {
                                            curTable.cols.push({
                                                name: item.str,
                                                slug: item.str.toLowerCase().replace(/[ ,]+/g, '-'),
                                                x: item.transform[5],
                                                y: item.transform[4]
                                            });
                                        }
                                    } else {
                                        curTable.cols.forEach((col, i2) => {
                                            if (col.x == item.transform[5]) {
                                                if (i2 === 0 && item.transform[4] - rowY > 12) {
                                                    curTable.rows.push({});
                                                    rowY = item.transform[4];
                                                }
                                                const curRow = curTable.rows[curTable.rows.length - 1];

                                                if (col.slug in curRow) {
                                                    if (col.slug !== '#') {
                                                        curRow[col.slug] += ' ';
                                                    }
                                                    curRow[col.slug] += item.str;
                                                } else {
                                                    curRow[col.slug] = item.str;
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    });

                    resolve();
                });

            });
    }

    const data = new Uint8Array(file.contents);

    // parse PDF document
    return new Promise((resolve,reject) => {
        _(pdfjs.getDocument(data))
            // get each page in the document
            .flatMap(doc => {
                let pages = [];

                for (let i = 1; i <= doc.numPages; i++) {
                    pages.push(i);
                }

                return _(pages)
                    .map(page => _(doc.getPage(page)));
            })
            .flatten()
            .map(processPage)
            .done(() => {
                saveFiling(file,tables)
                    .then(resolve,reject);
            });
    });
}

function processFilings(path) {
    // process all PDFs in the directory
    _(vfs.src(path + '**/*.@(pdf|PDF)'))
        .flatMap((file) => {
            return _(processFiling(file))
        })
        .each(({file,count}) => console.log(file.relative,count))
        .done(() => console.log('done'));
}

processFilings(filingsPath);
