const fs = require('fs'),
    yaml = require('js-yaml');

const spec = yaml.safeLoad(fs.readFileSync(__dirname + '/../swagger.yaml', 'utf8'));

module.exports = spec;
