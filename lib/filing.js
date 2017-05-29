const _ = require('highland'),
    dsv = require('d3-dsv'),
    fs = require('fs');

global.DOMParser = require('./domparsermock.js').DOMParserMock;

var pdfjs = require('pdfjs-dist');

class Filing {
    constructor(file) {
        this.file = file;
        this.tables = [];
        this.ignoreRest = false;
        this.skipHeaders = [];
        this.count = 0;
    }

    save(dataPath) {
        let filing = this;

        const fileName = this.file.basename
            .replace('.pdf', '')
            .replace('.PDF', '');

        return new Promise((resolve, reject) => {
            this.tables.forEach(table => {
                const csvFile = `${dataPath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`;

                table.rows.forEach(row => {
                    row.file = fileName;
                });

                if (table.cols.length > 0) {
                    const columns = ['file'].concat(table.cols.map(col => col.slug));
                    let csvString = dsv.csvFormat(table.rows, columns);

                    if (this.skipHeaders[table.name]) {
                        csvString = csvString.substring(csvString.indexOf('\n') + 1);
                    }
                    else {
                        this.skipHeaders[table.name] = true;
                    }

                    fs.appendFileSync(csvFile, `${csvString}\n`);

                    this.count += table.rows.length;
                }
            });

            resolve(filing);
        });
    }

    getBoldFont(content) {
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

    processPage(page) {
        let filing = this;

        const viewport = page.getViewport(1.0); // scale

        return page.getTextContent()
            .then(content => {
                return new Promise((resolve, reject) => {
                    let boldFont = filing.getBoldFont(content);
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

                        if (!ignorePage && !this.ignoreRest) {
                            if (item.height == 14) {
                                if (item.str == 'Filer\'s Information') {
                                    ignorePage = true;
                                } else if (item.str == 'Summary of Contents') {
                                    this.ignoreRest = true;
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

                                    this.tables.push({
                                        part,
                                        name,
                                        cols: [],
                                        rows: []
                                    });
                                }
                            } else if (item.height == 10) {
                                const curTable = this.tables[this.tables.length - 1];
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

    process() {
        let filing = this;

        const data = new Uint8Array(this.file.contents);

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
                .map(this.processPage.bind(filing))
                .stopOnError(() => reject())
                .done(() => resolve(filing));
        });
    }
}

module.exports = Filing;
