const dsv = require('d3-dsv'),
    fs = require('fs');

class Filing {
    constructor(file) {
        this.file = null;
        this.tables = [];
    }

    // does save belong in Filing or somewhere else?
    save(dataPath) {
        let filing = this;

        return new Promise((resolve, reject) => {
            this.tables.forEach(table => {
                const csvFile = `${dataPath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`;

                if (table.cols.length > 0) {
                    const columns = ['file'].concat(table.cols.map(col => col.slug));
                    let csvString = dsv.csvFormat(table.rows, columns);

                    let exists = fs.existsSync(csvFile);

                    if (exists) {
                        csvString = csvString.substring(csvString.indexOf('\n') + 1);
                    }

                    fs.appendFileSync(csvFile, `${csvString}\n`);

                    this.count += table.rows.length;
                }
            });

            resolve(filing);
        });
    }
}

module.exports = Filing;
