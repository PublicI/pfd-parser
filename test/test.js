const _ = require('highland'),
    chai = require('chai'),
    parser = require('../lib/parser'),
    vfs = require('vinyl-fs');

let should = chai.should();

const filingPath = __dirname + '/data/';

const integrityFiling = filingPath + 'Kushner, Jared.pdf',
    fdmFiling = filingPath + 'Donnelly, Sally.pdf',
    fdOnlineFiling = filingPath + 'Mashburn, Lori K.pdf';

describe('lib/parser.js', () => {
    it('should find seven tables in Integrity filing', (done) => {
        parser(integrityFiling)
            .then((filings) => {
                filings[0].tables.length.should.equal(7);

                done();
            });
    }).timeout(4000);

    it('should find seven tables in example FDM filing', (done) => {
        parser(fdmFiling)
            .then((filings) => {
                filings[0].tables.length.should.equal(7);

                done();
            });
    });

    it('should find seven tables in example FDonline filing', (done) => {
        parser(fdOnlineFiling)
            .then((filings) => {
                filings[0].tables.length.should.equal(7);

                done();
            });
    });
});


