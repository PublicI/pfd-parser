const _ = require('highland'),
    chai = require('chai'),
    parser = require('../lib/parser'),
    vfs = require('vinyl-fs');

let should = chai.should();

const kushner = __dirname + '/data/Kushner, Jared.pdf';

describe('lib/parser.js', () => {
    it('should find 10 tables in Jared Kushner\'s filing', (done) => {
        parser(kushner)
            .then((filing) => {
                filing.tables.length.should.equal(10);

                done();
            });
    }).timeout(15000);
});
