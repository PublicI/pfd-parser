const _ = require('highland'),
    Filing = require('./filing'),
    spec = require('./spec'),
    vfs = require('vinyl-fs'),
    Vinyl = require('vinyl'),
    clone = require('lodash.clonedeep');

global.DOMParser = require('./domparsermock.js').DOMParserMock;

var pdfjs = require('pdfjs-dist');

function parser(files) {
    let file = null,
        filing = null,
        curTable = null,
        viewport = null,
        fdOnline = false,
        rowY = 0;

    function getSlug (str) {
        return str.toLowerCase().replace(/[ ,/]+/g, '-');
    }

    function getDefinition(str) {
        return new Promise((resolve, reject) => {
            _.values(spec.definitions)
                .find((def) =>
                    def.title.toLowerCase() == str.toLowerCase() ||
                    (def.aliases && def.aliases.indexOf(str) !== -1))
                .stopOnError(reject)
                .apply((def) => {
                    resolve(def)
                });
        });
    }

    function getHeaderParts(name) {
        const headerParts = name.split('. ');

        let part = null;

        if (headerParts.length > 1) {
            part = parseInt(headerParts[0]);
            name = headerParts.slice(1).join('. ');
        }

        return {
            name,
            part
        };
    }

    function getFirstColumn(table) {
        return Object.keys(table.cols)[0];
    }

    function within(a,b,distance) {
        return a+distance > b && a-distance < b;
    }

    function processItem(item) {
        if (item.fontName == 'Helvetica') {
            fdOnline = true;
        }

        return getDefinition(item.str)
            .then((def) => {
                return new Promise((resolve, reject) => {
                    let firstCol = null;
                    if (curTable) {
                        firstCol = getFirstColumn(curTable);
                    }

                    // table header
                    if (typeof def !== 'undefined' && def) {
                        let table = getHeaderParts(def.title);

                        table.cols = clone(def.properties);
                        table.rows = [];
                        table.items = [];

                        curTable = table;

                        filing.tables.push(table);
                    }
                    // table column headers
                    else if ((firstCol && firstCol.toUpperCase() == item.str &&
                            item.x < 100) ||
                            (curTable && curTable.cols[firstCol].y &&
                            within(curTable.cols[firstCol].y,item.y,2))) {
                        if (firstCol && firstCol.toUpperCase() == item.str) {
                            Object.keys(curTable.cols)
                                .forEach((key) => {
                                    delete curTable.cols[key].x;
                                    delete curTable.cols[key].y;
                                });
                        }

                        let slug = getSlug(item.str);

                        if (!(slug in curTable.cols)) {
                            Object.keys(curTable.cols)
                                .forEach((key) => {
                                    if (key.indexOf(slug) !== -1 &&
                                        !curTable.cols[key].x) {
                                        slug = key;
                                    }
                                    else if (curTable.cols[key].aliases) {
                                        curTable.cols[key]
                                            .aliases
                                            .forEach((alias) => {
                                                if (alias.indexOf(slug) !== -1 &&
                                                    !curTable.cols[key].x) {
                                                    slug = key;
                                                }
                                            })
                                    }
                                });
                        }

                        if (slug in curTable.cols) {
                            curTable.cols[slug].x = item.x;
                            curTable.cols[slug].y = item.y;
                        }
                    }
                    // table rows
                    else if (curTable) {
                        Object.keys(curTable.cols).forEach((key,i) => {
                            let col = curTable.cols[key];

                                
                            if (col.x && within(col.x,item.x,2)) {
                                if ((fdOnline && item.y - rowY > 15) || (!fdOnline && i === 0 && item.y - rowY > 10)) {
                                    curTable.rows.push({});
                                    rowY = item.y;
                                }

                                if (curTable.rows.length > 0) { //  && item.y - rowY < 60
                                    if (fdOnline) {
                                        rowY = item.y;
                                    }

                                    let curRow = curTable.rows[curTable.rows.length - 1];

                                    if (key in curRow) {
                                        if (key !== '#' && key !== 'date') {
                                            curRow[key] += ' ';
                                        }
                                        curRow[key] += item.str;
                                    }
                                    else {
                                        curRow[key] = item.str;
                                    }
                                }
                                else {
                                    // console.log(item.str,item.y - rowY)
                                }
                            }
                        });
                    }

                    resolve(item);
                });
            });
    }

    function itemCompare(a,b) {
        if (a.y - b.y !== 0) {
            return a.y - b.y;
        }
        else {
            return a.x - b.x;
        }
    }

    function transformItem (item) {
        let transform = pdfjs.PDFJS.Util.transform(
              pdfjs.PDFJS.Util.transform(viewport.transform, item.transform),
              [1, 0, 0, -1, 0, 0]);

        item.x = transform[4];
        item.y = transform[5];

        return item;
    }

    function processPage(page) {
        rowY = 0;

        viewport = page.getViewport(1.0);

        return _(page.getTextContent())
            .flatten()
            .pluck('items')
            .flatten()
            .map(transformItem)
            .sortBy(itemCompare)
            .map(item => _(processItem(item)))
            .flatten();
    }

    function process() {
        filing = new Filing();

        filing.file = file.relative
            .replace('.pdf', '')
            .replace('.PDF', ''); // consider extracting the name out of the filing instead

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
                .flatMap(processPage)
                .stopOnError(() => reject())
                .done(() => {
                    filing.tables = filing.tables.filter((table) => {
                        return table.rows.length > 0;
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
