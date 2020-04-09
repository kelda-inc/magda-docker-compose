"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const path = require("path");
const URI = require("urijs");
const yargs = require("yargs");
const morgan = require("morgan");
const request = require("request");
const RegistryClient_1 = require("@keldaio/typescript-common/dist/registry/RegistryClient");
const buildSitemapRouter_1 = require("./buildSitemapRouter");
const getIndexFileContent_1 = require("./getIndexFileContent");
const setupIntegrationTest = require("./setupIntegrationTest");
const argv = yargs
    .config()
    .help()
    .option("listenPort", {
    describe: "The TCP/IP port on which the web server should listen.",
    type: "number",
    default: 6107
})
    .option("disableAuthenticationFeatures", {
    describe: "True to disable all features that require authentication.",
    type: "boolean",
    default: false
})
    .option("useLocalStyleSheet", {
    describe: "True to use prebuilt static stylesheet from web-client module.",
    type: "boolean",
    default: false
})
    .option("baseExternalUrl", {
    describe: "The absolute base URL of the Magda site, when accessed externally. Used for building sitemap URLs which must be absolute.",
    type: "string",
    required: true
})
    .option("registryApiBaseUrlInternal", {
    describe: "The url of the registry api for use within the cluster",
    type: "string",
    default: "http://localhost:6101/v0",
    required: true
})
    .option("baseUrl", {
    describe: "The base URL of the MAGDA Gateway, for building the base URLs of the APIs when not manually specified. Can be relative.",
    type: "string",
    default: "/"
})
    .option("devProxy", {
    describe: "The URL of the MAGDA API Gateway to proxy to. Useful in development when you want to serve everything from one port for CORS reasons",
    type: "string"
})
    .option("apiBaseUrl", {
    describe: "The base URL of the MAGDA API Gateway.  If not specified, the URL is built from the baseUrl.",
    type: "string"
})
    .option("searchApiBaseUrl", {
    describe: "The base URL of the MAGDA Search API.  If not specified, the URL is built from the apiBaseUrl.",
    type: "string"
})
    .option("contentApiBaseUrl", {
    describe: "The base URL of the MAGDA Content API.  If not specified, the URL is built from the apiBaseUrl.",
    type: "string"
})
    .option("registryApiBaseUrl", {
    describe: "The base URL of the MAGDA Registry API.  If not specified, the URL is built from the apiBaseUrl.",
    type: "string"
})
    .option("authApiBaseUrl", {
    describe: "The base URL of the MAGDA Auth API.  If not specified, the URL is built from the apiBaseUrl.",
    type: "string"
})
    .option("adminApiBaseUrl", {
    describe: "The base URL of the MAGDA admin API.  If not specified, the URL is built from the apiBaseUrl.",
    type: "string"
})
    .option("fallbackUrl", {
    describe: "An older system to fall back to - this url will be shown in a banner that says 'you can still go back to old site'.",
    type: "string"
})
    .option("datasetSearchSuggestionScoreThreshold", {
    describe: "The score threshold after which to display the dataset suggestion form",
    type: "number",
    default: 65
}).argv;
var app = express();
app.use(morgan("combined"));
const clientRoot = path.resolve(require.resolve("@keldaio/web-client/package.json"), "..");
const clientBuild = path.join(clientRoot, "build");
console.log("Client: " + clientBuild);
// const adminRoot = require.resolve("@keldaio/web-admin");
// const adminBuild = path.join(adminRoot, "build");
// console.log("Admin: " + adminBuild);
const apiBaseUrl = addTrailingSlash(argv.apiBaseUrl || new URI(argv.baseUrl).segment("api").toString());
const webServerConfig = {
    disableAuthenticationFeatures: argv.disableAuthenticationFeatures,
    baseUrl: addTrailingSlash(argv.baseUrl),
    apiBaseUrl: apiBaseUrl,
    contentApiBaseUrl: addTrailingSlash(argv.contentApiBaseUrl ||
        new URI(apiBaseUrl)
            .segment("v0")
            .segment("content")
            .toString()),
    searchApiBaseUrl: addTrailingSlash(argv.searchApiBaseUrl ||
        new URI(apiBaseUrl)
            .segment("this_value_is_wrong")
            .segment("search")
            .toString()),
    registryApiBaseUrl: addTrailingSlash(argv.registryApiBaseUrl ||
        new URI(apiBaseUrl)
            .segment("v0")
            .segment("registry")
            .toString()),
    authApiBaseUrl: addTrailingSlash(argv.authApiBaseUrl ||
        new URI(apiBaseUrl)
            .segment("v0")
            .segment("auth")
            .toString()),
    adminApiBaseUrl: addTrailingSlash(argv.adminApiBaseUrl ||
        new URI(apiBaseUrl)
            .segment("v0")
            .segment("admin")
            .toString()),
    previewMapBaseUrl: addTrailingSlash(argv.previewMapBaseUrl ||
        new URI(apiBaseUrl)
            .segment("..")
            .segment("preview-map")
            .toString()),
    correspondenceApiBaseUrl: addTrailingSlash(argv.correspondenceApiBaseUrl ||
        new URI(apiBaseUrl)
            .segment("v0")
            .segment("correspondence")
            .toString()),
    fallbackUrl: argv.fallbackUrl,
    datasetSearchSuggestionScoreThreshold: argv.datasetSearchSuggestionScoreThreshold
};
app.get("/server-config.js", function (req, res) {
    res.type("application/javascript");
        
    // Avoid caching so Kelda file sync demo will work reliably.
    res.setHeader("Cache-Control", "no-cache");
    
    res.send("window.magda_server_config = " + JSON.stringify(webServerConfig) + ";");
});
setupIntegrationTest(app, "web-server");
const indexFileContent = getIndexFileContent_1.default(clientRoot, argv.useLocalStyleSheet);
app.get(["/", "/index.html*"], function (req, res) {
    res.send(indexFileContent);
});
// app.use("/admin", express.static(adminBuild));
app.use(express.static(clientBuild));
// URLs in this list will load index.html and be handled by React routing.
const topLevelRoutes = [
    "search",
    "feedback",
    "contact",
    "account",
    "sign-in-redirect",
    "dataset",
    "projects",
    "publishers",
    "organisations",
    "suggest",
    "error"
];
topLevelRoutes.forEach(topLevelRoute => {
    app.get("/" + topLevelRoute, function (req, res) {
        res.send(indexFileContent);
    });
    app.get("/" + topLevelRoute + "/*", function (req, res) {
        res.send(indexFileContent);
    });
});
app.get("/page/*", function (req, res) {
    res.send(indexFileContent);
});
// app.get("/admin", function(req, res) {
//     res.sendFile(path.join(adminBuild, "index.html"));
// });
// app.get("/admin/*", function(req, res) {
//     res.sendFile(path.join(adminBuild, "index.html"));
// });
if (argv.devProxy) {
    app.get("/api/*", function (req, res) {
        console.log(argv.devProxy + req.params[0]);
        req.pipe(request({
            url: argv.devProxy + req.params[0],
            qs: req.query,
            method: req.method
        }))
            .on("error", err => {
            const msg = "Error on connecting to the webservice.";
            console.error(msg, err);
            res.status(500).send(msg);
        })
            .pipe(res);
    });
}
const robotsTxt = `User-agent: *
Crawl-delay: 100
Disallow: /auth
Disallow: /search

Sitemap: ${argv.baseExternalUrl}/sitemap.xml
`;
app.use("/robots.txt", (_, res) => {
    res.status(200).send(robotsTxt);
});
app.use(buildSitemapRouter_1.default({
    baseExternalUrl: argv.baseExternalUrl,
    registry: new RegistryClient_1.default({
        baseUrl: argv.registryApiBaseUrlInternal,
        maxRetries: 0
    })
}));
// Proxy any other URL to 404 error page
const maxErrorDataUrlLength = 1500;
app.use("/", function (req, res) {
    let redirectUri = new URI("/error");
    const url = req.originalUrl.length > maxErrorDataUrlLength
        ? req.originalUrl.substring(0, maxErrorDataUrlLength)
        : req.originalUrl;
    const errorData = {
        errorCode: 404,
        url: url
    };
    redirectUri = redirectUri.escapeQuerySpace(false).search(errorData);
    res.redirect(303, redirectUri.toString());
});
app.listen(argv.listenPort);
console.log("Listening on port " + argv.listenPort);
process.on("unhandledRejection", (reason, promise) => {
    console.error(reason);
});
function addTrailingSlash(url) {
    if (!url) {
        return url;
    }
    if (url.lastIndexOf("/") !== url.length - 1) {
        return url + "/";
    }
    else {
        return url;
    }
}
//# sourceMappingURL=index.js.map
