const _ = require('highland'),
    chai = require('chai'),
    Filing = require('../lib/filing'),
    vfs = require('vinyl-fs');

let should = chai.should();

const kushner = __dirname + '/data/Kushner, Jared.pdf';

describe('lib/filing.js', () => {
    it('should correctly parse Jared Kushner\'s assets', (done) => {
        _(vfs.src(kushner))
            .apply((file) => {
                let filing = new Filing(file);

                filing.process()
                    .then(() => {
                        filing.tables.length.should.equal(10);

                        done();
                    });
            });
    });
});
