module.exports = function (grunt) {

  'use strict';

  var fs = require('fs');
  var join = require('path').join;
  var resolve = require('path').resolve;

  var handlebars = require('handlebars');
  var glob = require('glob');

  var lineParsingRegExp = /^\s*\"([a-zA-Z0-9_\-\$]+)\"\s*=\s*\"(.*)\";\s*$/;
  var keys = [];

  var noop = Function.prototype;
  var slice = Array.prototype.slice;

  function Override () {
    var options = [].pop.call(arguments);
    options.inverse(this);
    options.fn(this);
  }

  function makeLanguageJSONFile (languageData) {

    var json = {};

    var lines = languageData.split(/[\r\n]+/);
    lines.forEach(function(line) {

      var sections = line.match(lineParsingRegExp);
      if (sections && sections.length >= 2 && !sections[1].match(/\s/)) {

        var key = sections[1];
        var value = sections[2];

        var regexps = [
          /%((\d+)\$)?@/g,
          /@((\d+)\$)?%/g
        ];

        var i = 1;
        regexps.forEach(function (regexp) {
          value = value.replace(regexp, function (x, y, num) {
            return '$' + (num || i++);
          });
        });

        value = value.replace(/\\\"/g, '"');
        json[key] = value;
      }
    });

    return json;
  }

  function overrideHelpers () {

    function localized (key) {
      if (keys.indexOf(key) === -1) {
        keys.push(key);
      }

      var data = slice.call(arguments, 1);
      data.forEach(function (argument, index) {
        if (toString.call(argument) == '[object String]' &&
            argument.indexOf('{{') > -1) {
          data[index] = handlebars.compile(argument)();
        }
      });
    }

    handlebars.registerHelper('localized', localized);
    handlebars.registerHelper('localized_trustable', localized);
    handlebars.registerHelper('if', Override);
    handlebars.registerHelper('else', Override);
    handlebars.registerHelper('unless', Override);
    handlebars.registerHelper('each', Override);
    handlebars.registerHelper('equal', Override);
    handlebars.helpers.helperMissing = noop;
  }

  function findUsedLocalizationKeys (options) {

    var templates = glob.sync('**/*.hbs', {'cwd': options.templatesSrcDir});
    var partials = glob.sync('**/*.hbs', {
      'cwd': resolve(options.templatesSrcDir, 'partials')
    });

    overrideHelpers();

    var fakePartial = handlebars.compile('');
    partials.forEach(function (file) {
      var name = file.replace(/\.hbs$/, '');
      handlebars.registerPartial(name, fakePartial);
    });

    templates.forEach(function (template) {
      grunt.log.debug('parsing', template);
      var path = resolve(options.templatesSrcDir, template);
      var code = grunt.file.read(path);
      handlebars.compile(code)();
    });

    var explicit = grunt.file.read('config/labels.txt');
    keys = keys.concat(explicit.split('\n'));

    grunt.log.debug('found', keys);
  }

  function makeLanguageFiles (options) {

    var langData = {};
    var srcDir = resolve(options.langSrcDir);
    var languageNames = fs.readdirSync(srcDir);

    languageNames.forEach(function (lang) {
      var srcLang = join(options.langSrcDir, lang, 'Localizable.strings');
      var file = fs.readFileSync(srcLang);
      var dataAsString = file.toString('utf8');
      var languageAsJSON = makeLanguageJSONFile(dataAsString);
      keys.forEach(function (key) {
        langData[key] = languageAsJSON[key];
      });

      var destFile = join(options.langDestDir, lang + '.json');
      grunt.file.write(destFile, JSON.stringify(langData, null, 2));
      grunt.log.debug('generated', lang);
    });
  }

  function BuildLanguageJSON () {
    var options = this.options({
      'templatesSrcDir': 'app/views',
      'langSrcFileName': 'Localizable.strings',
      'langSrcDir': 'app/assets/languages/strings',
      'langDestDir': 'app/assets/build/strings'
    });

    grunt.file.mkdir(options.langDestDir);
    findUsedLocalizationKeys(options);
    makeLanguageFiles(options);
  }

  grunt.registerTask(
    'compile/languages',
    'Compiles relevant language keys',
    BuildLanguageJSON
  );

  grunt.registerTask(
    'compile/lang',
    'Compiles relevant language keys',
    BuildLanguageJSON
  );
};
