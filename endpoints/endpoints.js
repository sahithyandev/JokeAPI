const http = require("http");
const convertFileFormat = require("../src/fileFormatConverter");
const httpServer = require("../src/httpServer");
const parseURL = require("../src/parseURL");
const jsl = require("svjsl");
const fs = require("fs");
const settings = require("../settings");

jsl.unused(http);


const meta = {
    "name": "Endpoints",
    "desc": "Returns a list of all endpoints and how to use them",
    "usages": [
        `GET ${settings.info.docsURL}/endpoints[?format] | Returns a list of all endpoints and how to use them`
    ]
};

/**
 * Calls this endpoint
 * @param {http.IncomingMessage} req The HTTP server request
 * @param {http.ServerResponse} res The HTTP server response
 * @param {Array<String>} url URL path array gotten from the URL parser module
 * @param {Object} params URL query params gotten from the URL parser module
 * @param {String} format The file format to respond with
 */
const call = (req, res, url, params, format) => {
    jsl.unused([req, url, params]);

    let endpointList = [];

    try 
    {
        fs.readdir(settings.endpoints.dirPath, (err, files) => {
            if(!err)
            {
                files.forEach(f => {
                    if(f.endsWith(".js"))
                    {
                        let fileMeta = require(`./${f}`).meta;

                        if(jsl.isEmpty(fileMeta))
                            return epError(res, format, `Couldn't find metadata object of endpoint "${f.replace(".js", "")}"`);

                        if(jsl.isEmpty(fileMeta.unlisted))
                        {
                            if(format != "xml")
                            {
                                endpointList.push({
                                    name: fileMeta.name,
                                    description: fileMeta.desc,
                                    usages: fileMeta.usages
                                });
                            }
                            else if(format == "xml")
                            {
                                endpointList.push({
                                    name: fileMeta.name,
                                    description: fileMeta.desc,
                                    usages: {"usage": fileMeta.usages}
                                });
                            }
                        }
                    }
                });
                return httpServer.pipeString(res, convertFileFormat.auto(format, endpointList), parseURL.getMimeTypeFromFileFormatString(format));
            }
            else return epError(res, format, err);
        });
    }
    catch(err)
    {
        return epError(res, format, err);
    }
};

const epError = (res, format, err) => {
    let errFromRegistry = require("." + settings.errors.errorRegistryIncludePath)["100"];
    httpServer.pipeString(res, convertFileFormat.auto(format, {
        "error": true,
        "internalError": true,
        "code": 100,
        "message": errFromRegistry.errorMessage,
        "causedBy": errFromRegistry.causedBy,
        "additionalInfo": err
    }), parseURL.getMimeTypeFromFileFormatString(format));
}

module.exports = { meta, call };