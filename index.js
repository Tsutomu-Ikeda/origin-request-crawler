"use strict";

const chromium = require('chrome-aws-lambda');

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

    const response = {
      status: "200",
      statusDescription: "OK",
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
      body: html.replace("<html", '<html style="background: #ff0;"') // 試しにボットの時だけ背景色を黄色に変えてみる
    };

    return callback(null, response);
  } catch (err) {
    return callback(err);
  }
};
