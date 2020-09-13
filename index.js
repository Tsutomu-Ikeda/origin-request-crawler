"use strict";

const chromium = require('chrome-aws-lambda');
const cheerio = require('cheerio');

const statusCodes = {
  "100": "Continue",
  "101": "Switching Protocols",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Found",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "306": "(Unused)",
  "307": "Temporary Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Request Entity Too Large",
  "414": "Request-URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Requested Range Not Satisfiable",
  "417": "Expectation Failed",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
};

const changeRequestUri = (request) => {
  const currentUri = request.uri;
  const isFile = currentUri.indexOf('.') !== -1;

  const serviceNames = [];

  const newUri = (() => {
    const name = currentUri.split('/')[1];
    if (serviceNames.includes(name)) {
      if (isFile) return currentUri;
      else return `/${name}/index.html`;
    } else {
      if (isFile) return currentUri;
      else return "/index.html";
    }
  })();

  if (request.uri != newUri) {
    request.uri = newUri;
    console.log(`Uri has changed to ${newUri}`);
  } else {
    console.log("Uri wasn't changed.")
  }

  return request;
};

exports.handler = async (event, context, callback) => {
  const dynamicRenderHeaderName = "X-Need-Dynamic-Render";
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  if (!headers[dynamicRenderHeaderName.toLowerCase()]) return callback(null, changeRequestUri(request));

  let browser = null;
  let page = null;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    page = await browser.newPage();
    await page.goto(`https://www.tomtsutom.com${request.uri}`, {
      waitUntil: "networkidle0"
    });
    const html = await page.content();

    await browser.close();
    const $ = cheerio.load(html)
    const status = $('meta[name="prerender-status-code"]').attr('content');
    $("body").prepend('<div style="background: #f5eb84; width: 100%; height: 100px; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; -webkit-justify-content: center; justify-content: center;">このページはクローラ用のサイトです。</div>');

    const response = {
      status,
      statusDescription: statusCodes[status],
      headers: {
        "cache-control": [
          {
            key: "Cache-Control",
            value: "max-age=100"
          }
        ],
        "content-type": [
          {
            key: "Content-Type",
            value: "text/html"
          }
        ],
        "content-encoding": [
          {
            key: "Content-Encoding",
            value: "UTF-8"
          }
        ]
      },
      body: $.html()
    };

    return callback(null, response);
  } catch (err) {
    return callback(err);
  }
};
