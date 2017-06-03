const _ = require('highland'),
    Filing = require('./filing'),
    Vinyl = require('vinyl'),
    vfs = require('vinyl-fs');

global.DOMParser = require('./domparsermock.js').DOMParserMock;

var pdfjs = require('pdfjs-dist');

function parser(files) {
    let file = null;
    let filing = null;
    let ignoreRest = false;

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

                                    filing.tables.push({
                                        part,
                                        name,
                                        cols: [],
                                        rows: []
                                    });
                                }
                            } else if (item.height == 10) {
                                const curTable = filing.tables[filing.tables.length - 1];
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

    function process() {
        filing = new Filing();

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
                .stopOnError(() => reject())
                .done(() => {
                    const fileName = file.relative
                        .replace('.pdf', '')
                        .replace('.PDF', '');

                    filing.file = fileName; // consider extracting the name out of the filing instead

                    filing.tables.forEach(table => {
                        table.rows.forEach(row => {
                            row.file = fileName;
                        });
                    });

                    resolve(filing);
                });
        });
    }

    function processList(fileList) {
        return new Promise((resolve,reject) => {
            _(fileList)
                .flatMap((file) => {
                    return _(parser(file));
                })
                .stopOnError(reject)
                .toArray(resolve);
        });
    }

    if (Vinyl.isVinyl(files)) {
        // is files just a vinyl file? process it
        file = files;

        return process();
    }
    else if (Array.isArray(files)) {
        // is files an array? parse each entry
        return processList(files);
    }
    else if (typeof files === 'string' || files instanceof String) {
        // is files a string? check if it seems to be a single file or use glob syntax
        if (files.toLowerCase().indexOf('.pdf') !== -1 ||
            files.toLowerCase().indexOf('*') !== -1) {
            // if so, src it directly
            return processList(vfs.src(files));
        }
        else {
            // otherwise, assume it's a directory and parse PDFs under the directory
            return processList(vfs.src(files + '**/*.@(pdf|PDF)'));
        }
    }
}

module.exports = parser;
