const _ = require('highland'),
    chai = require('chai'),
    Filing = require('../lib/filing'),
    vfs = require('vinyl-fs');

let should = chai.should();

const kushner = __dirname + '/data/Kushner, Jared.pdf';

// seems like this process should be better encapsulated by the filing parser
function processFiling(filePath,cb) {
    _(vfs.src(kushner))
        .apply((file) => {
            let filing = new Filing(file);

            filing.process()
                .then(() => {
                    cb(null,filing);
                },(err) => {
                    cb(err);
                });
        });
}

describe('lib/filing.js', () => {
    it('should find 10 tables in Jared Kushner\'s filing', (done) => {
       processFiling(kushner,(err,filing) => {
            filing.tables.length.should.equal(10);

            done();
       });
    });
});
