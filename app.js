const express = require("express");
const axios = require("axios");
const winston = require("winston");

// Define your logger configuration
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "./app.log" })],
});

const app = express();

app.use(express.json());
app.use(express.text({ type: "*/*" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const allowedHeaders = [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "access-control-allow-origin",
    "x-cons-id",
    "x-timestamp",
    "x-signature",
    "user_key",
    "x-duitku-signature",
    "x-duitku-timestamp",
    "x-duitku-merchantcode",
  ];

  // Set CORS headers
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200); // Preflight request, respond with 200 OK
  } else {
    next();
  }
});

app.use("/:url(*)", (req, res) => {
  try {
    let targetUrl = req.params.url;
    const method = req.method;

    // Check if the URL starts with "http://" or "https://"
    if (/^(https?|HTTPS?):\//.test(targetUrl)) {
      const match = targetUrl.match(/^(https?|HTTPS?):\//);

      if (match && targetUrl.charAt(match[0].length) !== "/") {
        targetUrl = targetUrl.replace(match[0], match[0] + "/");
      }
    } else {
      targetUrl = "http://" + targetUrl; // Add "http://" if it doesn't start with it
    }

    if (targetUrl === "http://" || targetUrl === "https://") {
      return res.status(400).send("Empty target URL");
    }

    const header = req.headers;
    if (header["x-content-type"]) {
      logger.info("heade contain X-Content-Type");
      header["content-type"] = header["x-content-type"];
    }
    logger.info("header", `${header}`);

    // Remove unwanted headers
    const unwantedHeaders = [
      "host",
      "connection",
      "sec-ch-ua",
      "sec-ch-ua-mobile",
      "user-agent",
      "sec-ch-ua-platform",
      "origin",
      "sec-fetch-site",
      "sec-fetch-mode",
      "sec-fetch-dest",
      "referer",
      "accept-encoding",
      "accept-language",
      "if-none-match",
      "x-forwarded-for",
      "x-forwarded-host",
      "x-forwarded-proto",
      "content-length",
    ];

    unwantedHeaders.forEach((key) => {
      delete header[key];
    });

    const mergedObject = { ...req.query, ...req.body };

    const options = {
      method: method,
      url: targetUrl,
      headers: header,
      maxBodyLength: Infinity,
      params: req.query,
    };

    if (Object.keys(req.body).length > 0) {
      options["data"] = req.body;
    }

    axios(options)
      .then(function (response) {
        // Store the response headers in an object
        const responseHeaders = {};

        logger.log("info", ` ${response.headers}`);
        // Add headers to the object
        Object.keys(response.headers).forEach((key) => {
          // Log messages
          logger.log("info", ` ${key} => ${response.headers[key]}`);
          if (
            ![
              "x-forwarded-for",
              "x-forwarded-host",
              "x-forwarded-proto",
              "x-powered-by",
              "x-frame-option",
              "x-content-type-options",
              "x-frame-options",
              "content-security-policy",
              "x-xss-protection",
              "server",
              "alt-svc",
              "connection",
              "transfer-encoding",
            ].includes(key)
          ) {
            responseHeaders[key] = response.headers[key];
          }
        });

        // Set the status and send both headers and data
        return res
          .status(response.status)
          .set(responseHeaders)
          .send(response.data);
      })
      .catch(function (error) {
        console.error("Error message", error.message);
        console.error("Error config", error.config);
        if (error.response) {
          console.error(`error.response.data`, error.response.data);
          console.error(`error.response.status`, error.response.status);
          console.error(`error.response.headers`, error.response.headers);
          return res.status(error.response.status).send(error.response.data);
        } else if (error.request) {
          console.error(`error.request`, error.request);
          return res.status(500).send(error.message);
        } else {
          console.error("Error", error.message);
        }

        return res.status(500).send(error);
      });
  } catch (error) {
    console.error(error);
    return res.status(500).send(error);
  }
});

app.listen(3000, () => {
  console.log("Proxy server listening on port 3000");
});
