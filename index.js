// jshint esnext:true
// Started as a PDF.js example file, originally licensed public domain

var fs = require('fs'),
    util = require('util'),
    dsv = require('d3-dsv'),
    path = require('path'),
    glob = require('glob');

global.DOMParser = require('./lib/domparsermock.js').DOMParserMock;

var pdfjsLib = require('pdfjs-dist');

const filePath = `${__dirname}/test/data/`;
let skipHeaders = {};

function processFiling(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));

    console.log(pdfPath);

    const tables = [];

    let ignoreRest = false;

    return pdfjsLib.getDocument(data).then(doc => {
        const numPages = doc.numPages;

        let lastPromise; // will be used to chain promises

        const loadPage = pageNum => doc.getPage(pageNum).then(page => {
            const viewport = page.getViewport(1.0 /* scale */ );

            return page.getTextContent().then(content => {
                let boldFont = '';

                const styleKeys = Object.keys(content.styles);
                styleKeys.forEach(styleKey => {
                    if (content.styles[styleKey].fontFamily == 'sans-serif' &&
                        content.styles[styleKey].descent < -0.295) {
                        boldFont = styleKey;
                    }
                });

                let ignorePage = false;
                let rowY = 0;

                content.items.sort((a, b) => {
                    if (a.transform[4] - b.transform[4] !== 0) {
                        return a.transform[4] - b.transform[4];
                    }
                    else {
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
                            }
                            else if (item.str == 'Summary of Contents') {
                                ignoreRest = true;
                            }
                            else if (item.str.trim().length > 2) {
                                const headerParts = item.str.split('. ');
                                let part = null;
                                let name = null;

                                if (headerParts.length > 1) {
                                    part = parseInt(headerParts[0]);
                                    name = headerParts.slice(1).join('. ');
                                }
                                else {
                                    name = item.str;
                                }

                                tables.push({
                                    part,
                                    name,
                                    cols: [],
                                    rows: []
                                });
                            }
                        }
                        else if (item.height == 10) {
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
                                }
                                else {
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
                                            }
                                            else {
                                                curRow[col.slug] = item.str;
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    }
                });

            });
        });

        lastPromise = loadPage(2);
        for (let i = 3; i <= numPages - 4; i++) {
            lastPromise = lastPromise.then(loadPage.bind(null, i));
        }
        return lastPromise;
    }).then(() => {
        const fileName = path.basename(pdfPath, '.pdf').replace('.PDF','');
        return new Promise((resolve, reject) => {
            tables.forEach(table => {
                const csvFile = `${filePath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`;

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
                }
            });

            resolve();
        });
    });
}

glob(filePath + '**/*.pdf', function (err, files) {
    if (err) {
        throw err;
    }

    let filingPromise = processFiling(files[0]);
    for (let pos = 1; pos < files.length; pos++) {
        filingPromise = filingPromise
            .then(processFiling.bind(null, files[pos]),
                console.log);
    }
    filingPromise.then(() => {
        console.log('done');
    });

});
