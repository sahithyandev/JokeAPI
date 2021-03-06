// this module parses all the jokes to verify that they are valid and that their structure is not messed up

const fs = require("fs-extra");
const jsl = require("svjsl");

const settings = require("../settings");
const debug = require("./verboseLogging");
const languages = require("./languages");
const AllJokes = require("./classes/AllJokes");

/**
 * Parses all jokes
 * @returns {Promise<Boolean>}
 */
const init = () => {
    return new Promise((resolve, reject) => {
        let jokesFiles = fs.readdirSync(settings.jokes.jokesFolderPath);
        let result = [];
        let allJokesFilesObj = {};

        let outerPromises = [];

        jokesFiles.forEach(jf => {
            if(jf == settings.jokes.jokesTemplateFile)
                return;

            outerPromises.push(new Promise((resolveOuter, rejectOuter) => {
                jsl.unused(rejectOuter);

                let fileNameValid = (fileName) => {
                    if(!fileName.endsWith(".json"))
                        return false;
                    let spl1 = fileName.split(".json")[0];
                    if(spl1.includes("-") && languages.isValidLang(spl1.split("-")[1]) && spl1.split("-")[0] == "jokes")
                        return true;
                    return false;
                };

                let getLangCode = (fileName) => {
                    if(!fileName.endsWith(".json"))
                        return false;
                    let spl1 = fileName.split(".json")[0];
                    if(spl1.includes("-") && languages.isValidLang(spl1.split("-")[1]))
                        return spl1.split("-")[1].toLowerCase();
                };

                let langCode = getLangCode(jf);

                if(!jf.endsWith(".json") || !fileNameValid(jf))
                    result.push(`${jsl.colors.fg.red}Error: Invalid file "${settings.jokes.jokesFolderPath}${jf}" found. It has to follow this pattern: "jokes-xy.json"`);


                fs.readFile(`${settings.jokes.jokesFolderPath}${jf}`, (err, jokesFile) => {
                    if(err)
                        return reject(err);

                    try
                    {
                        jokesFile = JSON.parse(jokesFile.toString());
                    }
                    catch(err)
                    {
                        return reject(`Error while parsing file "${settings.jokes.jokesFilePath}" as JSON: ${err}`);
                    }

                    //#MARKER format version
                    if(jokesFile.info.formatVersion == settings.jokes.jokesFormatVersion)
                        result.push(true);
                    else result.push(`Joke file format version is set to "${jokesFile.info.formatVersion}" - Expected: "${settings.jokes.jokesFormatVersion}"`);

                    jokesFile.jokes.forEach((joke, i) => {
                        //#MARKER joke ID
                        if(!jsl.isEmpty(joke.id) && !isNaN(parseInt(joke.id)))
                            result.push(true);
                        else result.push(`Joke with index/ID ${i} doesn't have an "id" property or it is invalid`);

                        //#MARKER type and actual joke
                        if(joke.type == "single")
                        {
                            if(!jsl.isEmpty(joke.joke))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} doesn't have a "joke" property`);
                        }
                        else if(joke.type == "twopart")
                        {
                            if(!jsl.isEmpty(joke.setup))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} doesn't have a "setup" property`);

                            if(!jsl.isEmpty(joke.delivery))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} doesn't have a "delivery" property`);
                        }
                        else result.push(`Joke with index/ID ${i} doesn't have a "type" property or it is invalid`);

                        //#MARKER flags
                        if(!jsl.isEmpty(joke.flags))
                        {
                            if(!jsl.isEmpty(joke.flags.nsfw) || (joke.flags.nsfw !== false && joke.flags.nsfw !== true))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} has an invalid "NSFW" flag`);

                            if(!jsl.isEmpty(joke.flags.racist) || (joke.flags.racist !== false && joke.flags.racist !== true))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} has an invalid "racist" flag`);

                            if(!jsl.isEmpty(joke.flags.sexist) || (joke.flags.sexist !== false && joke.flags.sexist !== true))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} has an invalid "sexist" flag`);

                            if(!jsl.isEmpty(joke.flags.political) || (joke.flags.political !== false && joke.flags.political !== true))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} has an invalid "political" flag`);

                            if(!jsl.isEmpty(joke.flags.religious) || (joke.flags.religious !== false && joke.flags.religious !== true))
                                result.push(true);
                            else result.push(`Joke with index/ID ${i} has an invalid "religious" flag`);
                        }
                        else result.push(`Joke with index/ID ${i} doesn't have a "flags" object or it is invalid`);
                    });

                    allJokesFilesObj[langCode] = jokesFile;
                    return resolveOuter();
                });
            }));
        });

        Promise.all(outerPromises).then(() => {
            let errors = [];

            result.forEach(res => {
                if(typeof res === "string")
                    errors.push(res);
            });

            let allJokesObj = new AllJokes(allJokesFilesObj);

            let formatVersions = [settings.jokes.jokesFormatVersion];
            languages.jokeLangs().map(jl => jl.code).sort().forEach(lang => {
                formatVersions.push(allJokesObj.getFormatVersion(lang));
            });

            if(!jsl.allEqual(formatVersions))
                errors.push(`One or more of the jokes files has an invalid format version`);

            module.exports.allJokes = allJokesObj;
            module.exports.jokeCount = allJokesObj.getJokeCount();
            module.exports.jokeCountPerLang = allJokesObj.getJokeCountPerLang();
            let fmtVer = allJokesObj.getFormatVersion("en");
            module.exports.jokeFormatVersion = fmtVer;
            this.jokeFormatVersion = fmtVer;


            debug("JokeParser", `Done parsing jokes. Errors: ${errors.length === 0 ? jsl.colors.fg.green : jsl.colors.fg.red}${errors.length}${jsl.colors.rst}`);

            if(jsl.allEqual(result) && result[0] === true && errors.length === 0)
                return resolve();
            
            return reject(`Errors:\n- ${errors.join("\n- ")}`);
        }).catch(err => {
            return reject(err);
        });
    });
}

/**
 * @typedef {Object} SingleJoke A joke of type single
 * @prop {String} category The category of the joke
 * @prop {("single")} type The type of the joke
 * @prop {String} joke The joke itself
 * @prop {Object} flags
 * @prop {Boolean} flags.nsfw Whether the joke is NSFW or not
 * @prop {Boolean} flags.racist Whether the joke is racist or not
 * @prop {Boolean} flags.religious Whether the joke is religiously offensive or not
 * @prop {Boolean} flags.political Whether the joke is politically offensive or not
 * @prop {Number} id The ID of the joke
 * @prop {String} lang The language of the joke
 */

/**
 * @typedef {Object} TwopartJoke A joke of type twopart
 * @prop {String} category The category of the joke
 * @prop {("twopart")} type The type of the joke
 * @prop {String} setup The setup of the joke
 * @prop {String} delivery The delivery of the joke
 * @prop {Object} flags
 * @prop {Boolean} flags.nsfw Whether the joke is NSFW or not
 * @prop {Boolean} flags.racist Whether the joke is racist or not
 * @prop {Boolean} flags.religious Whether the joke is religiously offensive or not
 * @prop {Boolean} flags.political Whether the joke is politically offensive or not
 * @prop {Number} id The ID of the joke
 * @prop {String} lang The language of the joke
 */

/**
 * Validates a single joke passed as a parameter
 * @param {(SingleJoke|TwopartJoke)} joke A joke object of type single or twopart
 * @returns {(Boolean|Array<String>)} Returns true if the joke has the correct format, returns string array containing error(s) if invalid
 */
const validateSingle = joke => {
    let jokeErrors = [];

    try
    {
        if(typeof joke == "object")
            joke = JSON.stringify(joke);

        joke = JSON.parse(joke);


        //#MARKER format version
        if(joke.formatVersion != null)
        {
            if(joke.formatVersion != settings.jokes.jokesFormatVersion || joke.formatVersion != this.jokeFormatVersion)
                jokeErrors.push(`Joke format version "${joke.formatVersion}" doesn't match up with required version "${this.jokeFormatVersion}"`);
        }
        else jokeErrors.push(`Joke doesn't have a "formatVersion" property or it is empty or invalid`);

        //#MARKER type and actual joke
        if(joke.type == "single")
        {
            if(jsl.isEmpty(joke.joke))
                jokeErrors.push(`Joke is of type "single" but doesn't have a "joke" property or it is empty`);
        }
        else if(joke.type == "twopart")
        {
            if(jsl.isEmpty(joke.setup))
                jokeErrors.push(`Joke is of type "twopart" but doesn't have a "setup" property or it is empty`);

            if(jsl.isEmpty(joke.delivery))
                jokeErrors.push(`Joke is of type "twopart" but doesn't have a "delivery" property or it is empty`);
        }
        else jokeErrors.push(`Joke doesn't have a "type" property or it is invalid - it has to be either "single" or "twopart"`);

        //#MARKER joke category
        if(joke.category == null)
            jokeErrors.push(`Joke doesn't have a "category" property or it is empty`);
        else
        {
            let categoryValid = false;
            settings.jokes.possible.categories.forEach(cat => {
                if(joke.category.toLowerCase() == cat.toLowerCase())
                    categoryValid = true;
            });
            if(!categoryValid)
                jokeErrors.push(`Joke category is invalid`);
        }

        //#MARKER flags
        if(!jsl.isEmpty(joke.flags))
        {
            if(jsl.isEmpty(joke.flags.nsfw) || (joke.flags.nsfw !== false && joke.flags.nsfw !== true))
                jokeErrors.push(`Joke doesn't have the "nsfw" flag or it is invalid`);

            if(jsl.isEmpty(joke.flags.racist) || (joke.flags.racist !== false && joke.flags.racist !== true))
                jokeErrors.push(`Joke doesn't have the "racist" flag or it is invalid`);
            
            if(jsl.isEmpty(joke.flags.sexist) || (joke.flags.sexist !== false && joke.flags.sexist !== true))
                jokeErrors.push(`Joke doesn't have the "sexist" flag or it is invalid`);

            if(jsl.isEmpty(joke.flags.political) || (joke.flags.political !== false && joke.flags.political !== true))
                jokeErrors.push(`Joke doesn't have the "political" flag or it is invalid`);

            if(jsl.isEmpty(joke.flags.religious) || (joke.flags.religious !== false && joke.flags.religious !== true))
                jokeErrors.push(`Joke doesn't have the "religious" flag or it is invalid`);
        }
        else jokeErrors.push(`Joke doesn't have a "flags" object or it is invalid`);

        //#MARKER lang
        if(jsl.isEmpty(joke.lang))
            jokeErrors.push(`Joke doesn't have a "lang" property or it is empty or of the wrong type`);
        
        let langV = languages.isValidLang(joke.lang);
        if(typeof langV === "string")
            jokeErrors.push(`"lang" parameter: ${langV}`);
        else if(langV !== true)
            jokeErrors.push(`Joke doesn't have a "lang" property or it is empty or of the wrong type`);
    }
    catch(err)
    {
        jokeErrors.push("Joke couldn't be parsed as valid JSON");
    }

    if(jsl.isEmpty(jokeErrors))
        return true;
    else return jokeErrors;
}

module.exports = { init, validateSingle }
