// Started as a PDF.js example file, originally licensed public domain

var fs = require('fs'),
    util = require('util');

global.DOMParser = require('./lib/domparsermock.js').DOMParserMock;

var pdfjsLib = require('pdfjs-dist');

var pdfPath = process.argv[2] || './test/data/Ross Wilbur L. Final 278.pdf';
var data = new Uint8Array(fs.readFileSync(pdfPath));

var tables = [];

pdfjsLib.getDocument(data).then(function(doc) {
    var numPages = doc.numPages;

    var lastPromise; // will be used to chain promises

    var loadPage = function(pageNum) {
        return doc.getPage(pageNum).then(function(page) {

            var viewport = page.getViewport(1.0 /* scale */ );

            return page.getTextContent().then(function(content) {

                var ignorePage = false;

                content.items.forEach(function (item,i) {

                    if (!ignorePage) {
                        if (item.height == 14) {
                            if (item.str == 'Filer\'s Information') {
                                ignorePage = true;
                            }
                            else if (item.str == 'Summary of Contents') {
                                ignorePage = true;
                            }
                            else if (item.str.trim().length > 2) {
                                var headerParts = item.str.split('. ');

                                tables.push({
                                    part: parseInt(headerParts[0]),
                                    name: headerParts.slice(1).join('. '),
                                    cols: [],
                                    rows: []
                                });
                            }
                        }
                        else if (item.height == 10) {
                            var curTable = tables[tables.length-1];

                            if (item.fontName == 'g_d0_f2') {
                                if (item.str == 'PART' || (item.str == '#' && curTable.cols.length > 1)) {
                                    curTable.cols = [];
                                }

                                var append = true;

                                curTable.cols.forEach(function (col) {
                                    if (col.x == item.transform[5]) {
                                        col.name += ' ' + item.str;
                                        col.slug = col.name.toLowerCase().replace(/[ ,]+/g,'-');
                                        append = false;
                                    }
                                });

                                if (append) {
                                    curTable.cols.push({
                                        name: item.str,
                                        slug: item.str.toLowerCase().replace(/[ ,]+/g,'-'),
                                        x: item.transform[5],
                                        y: item.transform[4]
                                    });
                                }
                            }
                            else {
                                curTable.cols.forEach(function (col,i2) {
                                    if (col.x == item.transform[5]) {
                                        if (i2 === 0 && content.items[i-1].transform[5] !== item.transform[5]) {
                                            curTable.rows.push({});
                                        }
                                        var curRow = curTable.rows[curTable.rows.length-1];

                                        if (col.slug in curRow) {
                                            curRow[col.slug] += '\n' + item.str;
                                        }
                                        else {
                                            curRow[col.slug] = item.str;
                                        }
                                    }
                                });
                            }
                        }
                    }
                });

            });
        });
    };

    lastPromise = loadPage(2);
    for (var i = 3; i <= numPages-4; i++) {
        lastPromise = lastPromise.then(loadPage.bind(null, i));
    }
    return lastPromise;
}).then(function() {
    console.log(JSON.stringify(tables));
}, function(err) {
    console.error('Error: ' + err);
});
