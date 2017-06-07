const dsv = require('d3-dsv'),
    fs = require('fs'),
    clone = require('lodash.clonedeep');

class Filing {
    constructor(file) {
        this.file = null;
        this.tables = [];
        this.count = 0;
    }

    // does save belong in Filing or somewhere else?
    save(dataPath) {
        let filing = this;

        return new Promise((resolve, reject) => {
            clone(this.tables).forEach(table => {
                const csvFile = `${dataPath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`;

                table.rows.forEach((row) => {
                    row.file = filing.file;
                });

                const columns = ['file'].concat(Object.keys(table.cols));
                let csvString = dsv.csvFormat(table.rows, columns);

                let exists = fs.existsSync(csvFile);

                if (exists) {
                    csvString = csvString.substring(csvString.indexOf('\n') + 1);
                }

                fs.appendFileSync(csvFile, `${csvString}\n`);

                this.count += table.rows.length;
            });

            resolve(filing);
        });
    }
}

module.exports = Filing;
